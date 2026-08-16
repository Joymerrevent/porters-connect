# RV-24 🟡 `defineFields` の使い方がどこにも無い

- 重要度: 🟡 ／ 観点: ドキュメント / DX
- 状態: open

## 概要

カスタム項目宣言 DSL `defineFields`（R-16・[ADR-0023][adr23]）は `src/index.ts` が export する公開 API で、
PRD では P1「実装済み」と数えられている。しかし**使い方が README に 0 箇所・`docs/guide/` に 0 箇所**。

## 根拠

- `grep -rn "defineFields" README.md docs/guide/` — ヒットは `error-handling.md:46,254` のみ
  （例外契約の文脈で名前が出るだけで、使い方ではない）。
- `src/index.ts:41` — `defineFields` を export している。
- [ADR-0023][adr23] — 詳細設計まで完了。
- [ADR-0035][adr35] — README 短節 ＋ `docs/guide/<topic>.md` の型を定め、
  Decision Drivers に「**機能の存在は README で気づけること**」を掲げている。
- 対比: oauth（F-1）・multi-tenancy（F-3）・bulk-write（F-4）は同じ型でガイドがある。

## 影響

**利用者が最初にぶつかる要求が、最も見つけにくい**。
PORTERS の実テナントは必ずカスタム項目（`U_` / `A_`）を持つため、
標準 `P_` だけで済む利用者はいない。存在に気づかなければ、
利用者は cast を書くか、このライブラリでは無理だと判断して離脱する。

最優先目標が「**多くの実利用者に使われること**」である以上、
未実装リソース 7 種より**この 1 件のほうが採用の障壁として大きい**。
機能自体は動くので 🟡 だが、優先度は高い。

## 検出経緯

[2026-08-16-01][run816]。[ADR-0035][adr35] の型（README 短節＋ガイド）が
F-1〜F-4 に適用されているかを 1 つずつ確認していて、
**型の外に `defineFields` が丸ごと落ちている**と分かった。
「実装済み」と数えられていたぶん、欠落が計画上も見えていなかった。

## 推奨

`docs/guide/custom-fields.md` を新設する（宣言 → client への受け渡し → 型がどう変わるか →
Field Read でテナントの項目を調べる手順 → 制限）。
README「リソースと操作」付近に 3〜5 行の節 ＋ `>` でガイドへ誘導。
[ADR-0035][adr35] の型に沿うだけなので**新しい決定は不要**（ADR 不要）。

## 処置

—

[adr23]: ../../adr/0023-custom-field-declaration-dsl.md
[adr35]: ../../adr/0035-usage-documentation-structure.md
[run816]: ../2026-08-16-01.md
