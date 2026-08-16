# RV-26 🟡 `P_Deleted` 未対応 ＝ 削除済みかを判別できない

- 重要度: 🟡 ／ 観点: API 忠実性
- 状態: open

## 概要

F-2（[ADR-0038][adr38]）で `itemstate: "deleted" | "all"` を実装した。削除 API が無い PORTERS で
削除済みレコードを読む唯一の手段であり、`"all"` は生存と削除済みを**混ぜて**返す。
ところが削除状態を表す標準項目 **`P_Deleted`（0=未削除 / 1=削除済み）が全リソースのカタログに無い**ため、
返ってきたレコードの**どれが削除済みかを利用者が判別できない**＝機能が半分しか届いていない

## 根拠

`docs/reference/resource-api/resources/candidate.md`（`Person.P_Deleted` の行：
「Read 時の field Parameter としてのみ指定可能。Condition や Order に指定不可。Write 不可」）／
同項目は全データリソースの reference に存在／`src/resources/*.ts` のカタログに `P_Deleted` は無し（実測）／
`src/resources/query.ts:105-113`（`ItemState`）

## 推奨

`P_Deleted` をカタログに載せる。ただし reference の Field Type / Data Type 欄が「ー」で
**decode 形（`Number` 相当か文字列か）が未確定**、かつ condition / order / write 不可という
**他項目に無い制約**を型でどう表すか（読み取り専用マーク）が新しい論点＝**要 ADR ＋ LV 追加**

## 処置

—

[adr38]: ../../adr/0038-read-query-surface-impl.md
