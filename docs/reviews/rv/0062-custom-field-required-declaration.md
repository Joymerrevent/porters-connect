# RV-62 🟢 カスタム項目を `create` の必須として宣言できない（テナントの `P_Required` を型に写せない）

- 重要度: 🟢 ／ 観点: DX / API 忠実性
- 状態: fixed

## 概要

`defineFields` で宣言したカスタム項目は**常に任意**で、`create` の入力型で必須にする書き方が無い
（[ADR-0023][adr23] D7「カスタムは `requiredOnCreate` に入らない（常に任意）」）。一方、PORTERS 側では
テナント管理者が項目を**入力必須**に設定でき、その状態は Field Read の `P_Required`（`0` = 通常 /
`1` = 入力必須）で読める。標準項目は出典の `●` を型の必須に写している（[ADR-0083][adr83]）のに、
カスタム項目はテナントが必須にしていても型が何も言わず、欠落は実行時にしか分からない。

利用者側から「PORTERS の項目では必須を設定できるのだから、カスタム項目の宣言でも必須を表せるように
してほしい」という要望として出た（2026-09-23・stakeholder）。

## 根拠

- `docs/adr/0023-custom-field-declaration-dsl.md:90` — D7「カスタムは `requiredOnCreate` に入らない（常に任意）」。
- `docs/adr/0083-conditionally-required-fields.md` — 「`●`（無条件必須）だけを型の必須にし、`※` はサーバーに委ねる」。
  規則の出典は PORTERS のリソース表（静的）で、テナント設定（実行時に読む `P_Required`）は扱っていない。
- `docs/usage/topics/custom-fields.md`「宣言せずに読み書きする方法」節 — 「宣言しても必須項目は増えません」
  「`f.number()` などの宣言にも、必須を表す書き方はありません」「PORTERS 側では項目を入力必須に設定できます…
  宣言には載らないので型では止まらず、PORTERS が弾きます」。
- `docs/usage/reference/resource-api/resources/field.md:34` — `Field.P_Required`（`0`：通常項目 / `1`：入力必須項目）。
- `src/fields/tenant-catalog.ts` — `readCustomCatalog` が持ち帰るのは `P_Alias` / `P_Type` / `P_Name` で、
  `P_Required` は読んでいない。したがって `generateFieldDecls` も `verifyFields` も必須の情報を扱えない。
- `docs/live-verification.md` — **API が Write 時に `P_Required` を強制するかどうかの項目は無い**。
  ガイドの「PORTERS が弾きます」は出典に無く、実機未確認の前提。

## 影響

🟢。いまの動作は「テナントが必須にした項目を渡し忘れても型は通り、実行時に PORTERS の判定を受ける」で、
標準項目の `※`（条件付き必須）と同じ扱い。黙って壊れるわけではない（PORTERS が弾くなら Result Code、
弾かないなら空のまま登録される）。ただし後者なら**気づけない**ので、API の強制の有無は設計の前提として
確かめる価値がある。

型で止められれば、標準項目の `●` と同じく「実行して Result Code を見るまでもなく止まる」体験が
カスタム項目にも広がる。テナントごとに必須が違う SaaS では、宣言に写すことで「どのテナントで何が必須か」が
コードに現れる。

## 検出経緯

使い方ドキュメントの校閲中（#378）に、stakeholder が `generateFieldDecls` の出力を確認する流れで
「カスタム項目には必須を設定できないのか」と質問し、機能追加を提案した。実装と ADR を確かめて、
宣言 DSL に必須の表現が無いこと（ADR-0023 D7 の決定）と、`P_Required` をライブラリがどこでも読んでいない
ことを特定した。

## 推奨

- (a) **ADR で決める**（[ADR-0023][adr23] D7 を部分的に supersede する）。案の骨子:
  - 宣言側で**明示したときだけ**必須にする（opt-in）。例: `f.number({ required: true })`。
    `create` の入力型でそのキーを必須にし、`update` は従来どおり任意。
  - `readCustomCatalog` に `P_Required` を載せ、`generateFieldDecls` が `P_Required=1` の項目に
    `required: true` を出す。`verifyFields` は宣言と実物で必須が食い違う項目を報告する（新しい区分か、
    `typeMismatch` に並べる）。
  - 型が要求するのはあくまで**宣言に書いた必須**で、実行時に読んだ `P_Required` から型を作ることはしない
    （型はコンパイル時に決まる。[ADR-0004][adr04]）。利用者が必須にしたくなければ書かなければよいので、
    「型がサーバーより厳しくなる」問題（[ADR-0083][adr83] の論点）は利用者の選択に収まる。
- (b) (a) の前提として、**PORTERS の Write API が `P_Required` を強制するか**を契約後に実機で確かめる
  項目を [live-verification][lv] に足す。強制しないなら、型で止める価値はむしろ上がる（サーバーが
  黙って通すため）が、ガイドの「PORTERS が弾きます」は書き直しが要る。
- (c) ADR を書くまでの間、ガイドの「PORTERS が弾きます」を「PORTERS の判定に委ねます（API が必須を
  強制するかは実機未確認）」に弱めておく。

## 処置

**起票（案 (a)・2026-09-23）。** [ADR-0089][adr89] を proposed で起票した（推奨は opt-in の `f.number({ required: true })`・
`generateFieldDecls` が `P_Required=1` を写す・`verifyFields` は報告だけ）。案 (b) のライブ検証の項目は、
`pnpm check:lv` がコードの印と両方向で突き合わせるので実装の PR で足す。

**accepted（2026-09-24）。** decider が推奨どおり（案1a ＋ 2a ＋ 3a ＋ 4a）を選んだ。

**実施（2026-09-24・本 PR）。** 案 (a)(b)(c) をすべて処置した。

- `defineFields` のビルダーが `{ required: true }` を受け、`create` / `createMany` の入力型で必須になる（`src/fields/define-fields.ts`・
  `src/client.ts` の `RequiredFor`・11 リソースの型）。`update` は任意のまま、実行時の検査は無い
- `readCustomCatalog` が `P_Required` を読み（`required`）、`generateFieldDecls` が `{ required: true }` を出し、
  `verifyFields` が `requiredMismatch` を返す（`ok` は倒さない）
- ライブ検証に [LV-32][lv] を足し、`src/fields/tenant-catalog.ts` に `VERIFY(live)` の印を置いた（案 (b)）
- ガイド「カスタム項目」に「新規作成で必須にする」を足し、「PORTERS が弾きます」を断定しない書き方にした（案 (c)）

## 検証

- 型: 11 リソースそれぞれで、宣言した必須が `create` の入力で必須になること（`src/fields/custom-fields.test.ts`）。
  `RequiredFor` のリソース名を取り違えると型検査が落ちることを、一時的に壊して確かめた
- 実行時: 必須の記録・非真偽値の拒否（`define-fields.test.ts`）、`P_Required` の読み取り（`tenant-catalog.test.ts`）、
  生成（`generate-field-decls.test.ts`）、食い違いの報告（`verify-fields.test.ts`）
- ガイドのコード例は `pnpm check:docs` がコンパイルする（渡し忘れが型エラーになる例を含む）

[adr04]: ../../adr/0004-field-type-model.md
[adr23]: ../../adr/0023-custom-field-declaration-dsl.md
[adr83]: ../../adr/0083-conditionally-required-fields.md
[adr89]: ../../adr/0089-custom-field-required-on-create.md
[lv]: ../../live-verification.md
