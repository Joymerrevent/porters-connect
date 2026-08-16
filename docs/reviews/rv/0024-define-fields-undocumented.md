# RV-24 🟡 `defineFields` の使い方がどこにも無い

- 重要度: 🟡 ／ 観点: ドキュメント / DX
- 状態: open

## 概要

カスタム項目宣言 DSL `defineFields`（R-16・[ADR-0023][adr23]）は `src/index.ts` が export する公開 API で、
PRD では P1「実装済み」と数えられている。しかし**使い方が README に 0 箇所・`docs/guide/` に 0 箇所**
（`error-handling.md` に例外契約の文脈で名前が出るだけ）。[ADR-0035][adr35] は
「**機能の存在は README で気づけること**」を Decision Driver に掲げ、README 短節＋ `docs/guide/<topic>.md` の型を定めたが、
**`defineFields` だけがその型から漏れている**。PORTERS の実テナントは必ずカスタム項目（`U_`/`A_`）を持つため、
**利用者が最初にぶつかる要求が最も見つけにくい**状態になっている

## 根拠

`grep -rn "defineFields" README.md docs/guide/` ＝ ヒットは `error-handling.md:46,254` のみ／
`src/index.ts:41`（export）/ [ADR-0023][adr23]（詳細設計）/ [ADR-0035][adr35]（README とガイドの役割分担）/
対比: oauth（F-1）・multi-tenancy（F-3）・bulk-write（F-4）は同じ型でガイドあり

## 推奨

`docs/guide/custom-fields.md` を新設（宣言 → client への受け渡し → 型がどう変わるか → Field Read で
テナントの項目を調べる手順 → 制限）。README「リソースと操作」付近に 3〜5 行の節＋ `>` ポインタ。
ADR-0035 の型に沿うだけなので新しい決定は不要（**ADR 不要**）

## 処置

—

[adr23]: ../../adr/0023-custom-field-declaration-dsl.md
[adr35]: ../../adr/0035-usage-documentation-structure.md
