# RV-26 🟡 `P_Deleted` 未対応で削除済みかを判別できない

- 重要度: 🟡 ／ 観点: API 忠実性
- 状態: open

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

—

[adr38]: ../../adr/0038-read-query-surface-impl.md
[lv]: ../../live-verification.md
[run816]: ../2026-08-16-01.md
