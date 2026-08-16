# RV-23 🔴 Candidate の静的カタログが標準項目 4 件を欠く

- 重要度: 🔴 ／ 観点: API 忠実性 / 型安全
- 状態: open

## 概要

Candidate の `FIELDS` カタログに、reference が定義する標準項目のうち
**`P_Memo`（メモ・MultilineText）／`P_Street`（住所詳細・MultilineText）／`P_Fax`（Telephone）／
`P_PhaseMemo`（フェーズメモ・MultilineText）の 4 件が無い**。[ADR-0019][adr19] は
「**カタログが single source of truth**」＝ Read 型も Write 入力型もカタログ導出なので、
欠落はそのまま**公開型の欠落**になる。`candidate.create({ P_Memo: "…" })` は型エラーになり、
既定 field 送信（[ADR-0020][adr20]）もカタログ由来のため **Read でも取りに行かない**。
同じ 4 種は **Client には全て載っており**（`src/resources/client.ts:30-38`）、リソース間で非一貫
＝設計判断ではなく取りこぼし（ADR-0019 にも「標準項目の部分実装」方針は無い）

## 根拠

`src/resources/candidate.ts:20-39`（18 項目のカタログ）/
`docs/reference/resource-api/resources/candidate.md`（`Person.P_Memo` / `P_Street` / `P_Fax` / `P_PhaseMemo` の行）/
対比 `src/resources/client.ts:30-38`（`P_Memo`/`P_Street`/`P_Fax`/`P_PhaseMemo` あり）/
[ADR-0019][adr19]（カタログ＝真実源）・[ADR-0020][adr20]（既定 field はカタログ導出）

## 検出経緯

2026-08-16 レビュー。stakeholder の「どこまで完成しているか」への回答として
**reference の全 `P_` alias と全カタログを機械的に突き合わせた**ところ検出。
Client / Job / Resume / Process の差分は `Reference` 型（Field Type 16 ＝ 参照表示専用で値を持たない）と
`P_Deleted` だけ＝正しい除外で、**Candidate だけが値のある標準項目を落としていた**

## 推奨

カタログに 4 件を追加する（Data Type は reference のとおり Telephone / MultilineText）。
型は自動追従するので変更は 1 箇所。semver は **minor**（公開型に項目が増える）。
併せて **RV-29**（reference ↔ カタログ突合の自動化）で再発を止める

## 処置

—

[adr19]: ../../adr/0019-static-resource-types.md
[adr20]: ../../adr/0020-read-field-default.md
