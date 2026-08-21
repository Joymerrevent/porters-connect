# RV-24 🟡 `defineFields` の使い方がどこにも無い

- 重要度: 🟡 ／ 観点: ドキュメント / DX
- 状態: fixed

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

`docs/guide/custom-fields.md` を新設した（[ADR-0035][adr35] の型どおり）。
README には「リソースと操作」の中に**カスタム項目の節**を足し、3 行の例と `>` でガイドへ誘導する。

ガイドで扱ったのは、宣言の書き方／**宣言しないとどうなるか**（型が付かず `field` 省略時に
取得もされない・エラーにはならない）／宣言できる 11 の Data Type と読み取り値の対応／
**Field Read でテナントの項目を調べる手順**／`defineFields` が検証すること（alias の接頭辞・
リソース名。同期 throw である理由も）／**値レベルの検証はしない**方針とその理由／
複数テナントで項目構成が違う場合の使い分け（`tenant(id)` はカタログを共有する）。

## 検証

- **コード例が型検査を通ることを確認した**。ガイドの全スニペットを 1 ファイルに写して
  `tsc --noEmit -p test` に掛け、エラーなしを確認（`U_score` が `number | null | undefined`、
  `U_source` が `string[] | null | undefined` になることも型注釈で固定して確認）。
  わざと型エラーを混ぜると検出されることも確かめ、**検査が空振りしていない**ことを担保した。
- README・ガイドの相対リンク 63 本すべてが実在することを確認。
- `pnpm lint:md` 緑（参照スタイル・markdownlint とも）。

[ADR-0035][adr35] が掲げた「機能の存在は README で気づけること」を満たす状態になった。

[adr23]: ../../adr/0023-custom-field-declaration-dsl.md
[adr35]: ../../adr/0035-usage-documentation-structure.md
[run816]: ../2026-08-16-01.md
