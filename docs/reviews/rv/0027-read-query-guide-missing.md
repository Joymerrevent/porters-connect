# RV-27 🟢 F-2（Read クエリ）だけトピック ガイドが無い

- 重要度: 🟢 ／ 観点: ドキュメント / DX
- 状態: fixed

## 概要

[ADR-0035][adr35] の型（README 短節 ＋ `docs/guide/<topic>.md`）で
F-1 → `oauth.md`、F-3 → `multi-tenancy.md`、F-4 → `bulk-write.md` が用意されたが、
**F-2（Read クエリ）だけガイドが無い**。

## 根拠

- `ls docs/guide/` — 4 本（bulk-write / error-handling / multi-tenancy / oauth）。
- [ADR-0035][adr35] — 「F-2〜F-4 も同じ型で足せる」と明記している。
- `README.md:189-198` — 箇条書きでの説明はある。

## 影響

**実際に手が止まる部分が README の箇条書きでは足りない**:
condition の Data Type 別演算子（テキストは `part` / `full`、Option は `or` / `and`、数値・日時は `gt`〜`lt`）、
削除済み Read の制約（90 日以内・`P_Id` / `P_UpdateDate` / `P_UpdatedBy` の 3 項目のみ）、
order の対象型（数値・日時・System のみ）。

これらを知るには [ADR-0038][adr38] を読むしかないが、**ADR は決定の記録であって使い方の説明ではない**。
Read クエリは最も使われる機能なので効く相手は多いが、
README に最低限の記述はあるため 🟢。

## 検出経緯

[2026-08-16-01][run816]。[ADR-0035][adr35] の型が F-1〜F-4 に適用されているかを
1 つずつ確認して、F-2 だけ抜けていると分かった（[RV-24][rv24] と同じ確認作業）。

## 推奨

`docs/guide/read-query.md` を新設する。[RV-24][rv24] と同じ作業単位で片付く（**ADR 不要**）。

## 処置

`docs/guide/read-query.md` を新設した（[RV-24][rv24] と同じ作業単位）。
README の検索クエリの箇条書きに `>` でガイドへの導線を足した。

ガイドで扱ったのは、`field` の 3 通りの意味（省略＝全項目 / `[]`＝主キーのみ / 明示）／
**Data Type ごとの演算子一覧**（表）／日時は ISO 8601 で渡すこと／上位リソースの ID による絞り込み／
order の対象型／keywords の 100 文字制限／**削除済み Read の制約**（condition は 3 項目・90 日以内・
`P_UpdateDate` は削除日時）／ページング／**送信前に落ちるものの一覧**。

未対応の点も隠さず書いた — `count` の範囲検証は未実装（[RV-28][rv28]）、
どれが削除済みかは判別できない（[RV-26][rv26]）。

## 検証

- **コード例が型検査を通ることを確認した**（[RV-24][rv24] と同じ方法）。
  `condition` の演算子・`order` の対象型・`itemstate` の値まで含め、
  ガイドに書いた組み合わせがすべて型で通ることを確かめた。
- 演算子の表は `src/resources/query.ts` の型定義（`IdCondition` / `NumberCondition` /
  `TemporalCondition` / `TextCondition` / `OptionCondition` / `ReferenceCondition` /
  `OrderableDataType`）と 1 対 1 で突き合わせた。
- keywords 100 文字・itemstate の 3 項目制限は実装（`KEYWORDS_MAX_CHARS` /
  `DELETED_CONDITION_FIELDS`）と一致することを確認。

[adr35]: ../../adr/0035-usage-documentation-structure.md
[adr38]: ../../adr/0038-read-query-surface-impl.md
[rv24]: 0024-define-fields-undocumented.md
[rv26]: 0026-deleted-flag-unsupported.md
[rv28]: 0028-count-range-unvalidated.md
[run816]: ../2026-08-16-01.md
