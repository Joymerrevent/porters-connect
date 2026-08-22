# RV-26 🟡 `P_Deleted` 未対応で削除済みかを判別できない

- 重要度: 🟡 ／ 観点: API 忠実性
- 状態: fixed

## 概要

F-2（[ADR-0038][adr38]）で `itemstate: "deleted" | "all"` を実装した。
削除 API が無い PORTERS で削除済みレコードを読む唯一の手段であり、`"all"` は生存と削除済みを**混ぜて**返す。
ところが削除状態を表す標準項目 **`P_Deleted` が全リソースのカタログに無い**。

## 根拠

- `docs/reference/resource-api/resources/candidate.md` — `Person.P_Deleted` の行:
  「0：削除されていないレコード / 1：削除済みのレコード」「**Read 時の field Parameter としてのみ指定可能**。
  Condition や Order に指定することはできません」「Write 時の指定はできません」。
- 同項目は**全データリソースの reference に存在する**。
- `src/resources/*.ts` のカタログに `P_Deleted` は無し（実測）。
- `src/resources/query.ts:105-113` — `ItemState` の定義。

## 影響

`itemstate: "all"` で読んだときに、**返ってきたレコードのどれが削除済みかを利用者が判別できない**。
削除済みを読む手段を提供しながら、**その結果を解釈する手段が無い**＝機能が半分しか届いていない。

削除 API が存在しない PORTERS では「削除済みを読む」こと自体が重要な運用手段
（同期・監査・復元の判断材料）なので、判別不能は実用上の制約になる。
`itemstate` を使わなければ発火しないため 🟡。

## 検出経緯

[2026-08-16-01][run816]。API 機能網羅の棚卸しで `itemstate` の実装を確認していて、
「削除済みを読めるが、どれが削除済みか分かるのか」を辿って判明した。

## 推奨

`P_Deleted` をカタログに載せる。ただし論点が 2 つある。

- reference の Field Type / Data Type 欄が「ー」で、**decode 形（`Number` 相当か文字列か）が未確定**
  ＝ [live-verification][lv] への LV 追加が要る。
- **condition / order / write 不可**という**他の項目に無い制約**を型でどう表すか
  （読み取り専用マーク）が新しい設計論点。

**要 ADR ＋ LV 追加**。

## 処置

[ADR-0056][adr56] を **accepted**（**案B**）ののち実装。**`FieldCatalog` の値を `DataType | null` に広げ**、
5 リソースのカタログに **`P_Deleted: null`** を置いた。`null` は新しい Data Type ではなく、
**「PORTERS がこの項目に Data Type を与えていない」という正典の事実（reference の「ー」）をそのまま写す不在マーカー**。

起票時の推奨は「新しい Data Type `System[Deleted]` を足す」だったが、これは
[ADR-0016][adr16] 案B（PORTERS がしない区別は発明しない）に**正面から違反**するため撤回した。
次に推した「型付けせず 2 回呼ぶ運用の文書化」も、案B のコスト見積もりが**過大な誤り**だと分かって次善に下げた。
経緯は ADR に残してある。

上の「推奨」に挙げた 2 つの論点はこう解けた。

- **decode 形が未確定** → 決めずに済んだ。**Data Type が無い＝変換の基準が無い**ので、
  値は**生の文字列** `"0"` / `"1"` のまま返す。`number` / `boolean` にするのはこちらで決めること＝小さいながら発明。
  wire 形そのものは未確認のままなので **[LV-14][lv]** を登録した（decode に `VERIFY(live)`）。
- **condition / order / write 不可を型でどう表すか** → **専用の表現は要らなかった**。
  公開型の導出が**すべて `keyof F`** で回っているため、`null` を置くだけで
  `ConditionFor<null>` は分岐末尾の `never` に落ち、`OrderableKeys` / `WritableKeys` からは外れる。
  **読み取り専用マークを新設せず、追加のガード実装もゼロ**で 3 つの制約が型に現れる。

`DataType` 自体に `null` を入れる案は採らなかった。`WritableDataType` が `Exclude<DataType, …>` の
派生なので、`null` が `Exclude` をすり抜けて**Write 入力型に現れてしまう**（型検査で確認）。
不在は「対応表」であるカタログ側に置くほうが**既定で安全側**に倒れる。

semver は **minor**（公開型に項目が増える。既存コードへの影響なし）。

## 検証

- **L1 で 3 状態を pin**（`test/integration/candidate.test.ts`）。生存 1 件・削除済み 1 件を seed し、
  `existing`（既定）は生存のみ・`deleted` は削除済みのみ・`all` は両方を返して `P_Deleted` で判別できることを固定した。
  併せて **Write では絶対に削除済みにならない**ことも pin（`create` したレコードは常に `"0"`）。
- **フェイクが削除状態を表現できるようにした**（当初の実装漏れ）。最初は「PORTERS に削除 API が無い」を根拠に
  フェイクの store も削除を一切持たず、`itemstate` は**実質テスト不能**なままだった。だが**削除の API 操作が無い**ことと
  **削除済みという状態のデータが無い**ことは別物で、実 PORTERS の削除済みレコードは**画面（API の外）で作られる** —
  だからこそ読み取り専用の `itemstate` が存在する。この 2 つの混同こそが本 finding の根であり、
  それをフェイク側にも持ち込んでいた。いまは **seed だけが削除済みを置ける**（`seedRecord`）＝
  実機で UI から削除されるのに対応する外部経路で、**リクエスト経由では何も削除できない**非対称を保っている。
  seed の値が `"0"` / `"1"` 以外なら fixture の誤りとして `PortersConfigError` で弾く（黙って生存扱いにしない）。
- **型で禁じられていることを型テストで pin**（`src/resources/static-types.test.ts`）。
  condition の `P_Deleted` は `undefined`、order の要素型と create/update 入力には現れない。
- **突合テストを更新**（`test/integration/reference-catalog.test.ts`）。`NOT_IN_CATALOG` から `ー` を外し、
  `ー` → `null` の写像を検査に加えた。`Reference`（Field Type 16）は**値を持たない**ので除外のまま＝
  **除外理由が違う**ことをコメントで書き分けた。この 2 つを一緒くたにしていたのが本 finding の原因。
- **フェイクは `P_Deleted` を server-owned として扱う**（`test/fake/records.ts`）。Write でキャスト経由に
  `"1"` を送っても落として `"0"` にする（reference「Write 時の指定はできません」）。
- **Field master は `null` 型の項目を行にしない**（`test/fake/master-read.ts`）。Field Type Value を
  持たない項目に値を割り当てるのは、本 ADR が拒んだ捏造そのものになるため。
- 626 tests 緑・typecheck / lint 通過。

[adr16]: ../../adr/0016-field-type-granularity.md
[adr38]: ../../adr/0038-read-query-surface-impl.md
[adr56]: ../../adr/0056-deleted-flag-typing.md
[lv]: ../../live-verification.md
[run816]: ../2026-08-16-01.md
