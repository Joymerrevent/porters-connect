# RV-27 🟢 F-2 だけトピック ガイドが無い

- 重要度: 🟢 ／ 観点: ドキュメント / DX
- 状態: open

## 概要

[ADR-0035][adr35] の型（README 短節＋ `docs/guide/<topic>.md`）で F-1 → `oauth.md`、
F-3 → `multi-tenancy.md`、F-4 → `bulk-write.md` が用意されたが、**F-2（Read クエリ）だけガイドが無い**。
README の箇条書き（`README.md:189-198`）はあるものの、condition の Data Type 別演算子・
削除済み Read の制約（90 日 / 3 項目）・order の対象型といった**実際に手が止まる部分**は
[ADR-0038][adr38] を読むしかない（ADR は決定の記録であって使い方の説明ではない）

## 根拠

`ls docs/guide/`（4 本：bulk-write / error-handling / multi-tenancy / oauth）/
[ADR-0035][adr35]（「F-2〜F-4 も同じ型で足せる」）/ `README.md:189-198`

## 推奨

`docs/guide/read-query.md` を新設。RV-24 と同じ作業単位で片付く（**ADR 不要**）

## 処置

—

[adr35]: ../../adr/0035-usage-documentation-structure.md
[adr38]: ../../adr/0038-read-query-surface-impl.md
