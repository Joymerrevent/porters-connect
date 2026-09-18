# RV-51 🟢 生成した公開 API リファレンスに日本語が混ざる

- 重要度: 🟢 ／ 観点: ドキュメント / DX
- 状態: open

## 概要

CLAUDE.md は「**公開サーフェス（型名・メソッド名・public API の JSDoc）は英語**」と定めているが、
`docs/usage/api/`（[ADR-0068][adr68] で生成する公開 API リファレンス・187 頁）の 4 頁に
日本語が残っている。うち 1 件は**コード例の中のコメント**で、周囲の例がすべて英語なので目立つ。

## 根拠

`grep -rn '[ぁ-んァ-ヶ一-龠]' docs/usage/api/` の実測 — 4 ファイル 5 行:

| 生成物                                         | 該当                                                 | 出所（JSDoc）                         |
| ---------------------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| `type-aliases/AttachmentAccessor.md:17-18`     | `// メタデータだけ` / `// 本体つき`（`@example` 内） | `src/resources/attachment.ts:117-118` |
| `type-aliases/VerifyFieldsOptions.md:25`       | `（ADR-0069, accept 時の決定）`                      | `src/fields/verify-fields.ts`         |
| `type-aliases/ReadCustomCatalogOptions.md:28`  | 同じ言い回し                                         | `src/fields/tenant-catalog.ts`        |
| `type-aliases/GenerateFieldDeclsOptions.md:26` | 同じ言い回し                                         | `src/fields/generate-field-decls.ts`  |

後者 3 件は同一の定型句「accept 時の決定」が英文に混ざったもので、ADR の議事の言い回しが
そのまま公開 JSDoc に流れている。

あわせて `src/index.ts:161` に日本語の `//` コメントが 1 件ある
（`名前 ⇄ 数値の変換（ADR-0079）。…`）。こちらは JSDoc ではないので `.d.ts` にも
生成物にも出ないが、**明示 export でキュレーションしている公開サーフェスのファイルで
周囲 6 件の注釈がすべて英語**なので、同じ揺れの一部として挙げる。

## 影響

読者は国内の開発者なので**理解の妨げにはならない**（だから 🟢）。効いてくるのは 2 点:

- **生成物なので直しても再生成で戻る**。出所の JSDoc を直さないと恒久化しない＝
  気づいたときに直す運用だと腐り続ける。
- CLAUDE.md がこの規約を置いた理由（「海外コントリビュータは契約ゲートで実質入れない」一方で
  **公開面は英語**）に対して、リファレンスは最も公開面らしい成果物。
  README / guide は日本語ファーストで正しく、**API リファレンスだけが英語という切り分け**が
  4 頁で崩れている。
- 検査が無いので、今後書く JSDoc でも同じことが起きる。

## 検出経緯

観点 4（型安全 / 公開サーフェス）で「公開型・メソッド名・public JSDoc は英語」を確認するとき、
`src/index.ts` を読むだけでは JSDoc の実体（宣言元）が見えないので、**生成物側を grep した**
（[RV-30][rv30] を `dist/index.d.ts` から見つけたときと同じやり方）。
`src` 側の JSDoc を直接 grep すると内部実装コメントの日本語が大量にヒットして
規約違反かどうか判別できないが、**生成物に出たものは定義上すべて公開 JSDoc** なので
一発で切り分けられた。

## 推奨

1. 出所の JSDoc 4 箇所を英語に直す。`AttachmentAccessor` の `@example` は
   `// metadata only` / `// with the file body` 相当に。「accept 時の決定」は
   `(ADR-0069, as accepted)` 等に。
2. **検査を足す**（推奨・[RV-42][rv42] と同じ「仕組みで守る」）。`docs/usage/api/` に
   かな・カタカナが現れたら落とす 1 行を `scripts/check-api-reference.mjs` に足す
   （漢字は ADR 名や固有名詞で正当に出うるので、**かな・カタカナだけを見る**のが誤検知が少ない。
   実測でも今回の 5 行はすべてかな・カタカナを含む）。
   `docs/usage/api/` は生成物なので、検査対象を絞れば README / guide の日本語には当たらない。

挙動変更は無いので ADR は不要。

## 処置

—

[adr68]: ../../adr/0068-api-reference-tooling.md
[rv30]: 0030-generic-constraint-types-unexported.md
[rv42]: 0042-quality-gate-list-drift.md
