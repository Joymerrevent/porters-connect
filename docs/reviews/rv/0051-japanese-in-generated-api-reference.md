# RV-51 🟢 生成した公開 API リファレンスに日本語が混ざる

- 重要度: 🟢 ／ 観点: ドキュメント / DX
- 状態: fixed

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

**完了。** 推奨の 2 つを行った。

1. **出どころの JSDoc を直した**（生成物を直しても再生成で戻るので恒久化しない）:
   - 「accept 時の決定」→ `decided on accept`（`verify-fields.ts` / `tenant-catalog.ts` /
     `generate-field-decls.ts` — ADR の議事の言い回しがそのまま流れていた）
   - `AttachmentAccessor` の `@example` のコメント 2 行を英語に
   - `src/index.ts` の日本語コメント 1 件も英語に（JSDoc ではないので生成物には出ないが、
     周囲 6 件がすべて英語で揃っている公開サーフェスのファイルなので）
2. **検査を `check:api` に足した**（`kanaLines`）。生成物が最新であることを確かめた**後**に見る
   — 古い生成物の日本語を報告しても、再生成で消えるかもしれないため。

検査を書くにあたり、`scripts/check-api-reference.mjs` に CLI ガードを足して `main()` に包んだ。
export した関数をテストから import したときに typedoc が走ってしまうため
（他の `check:*` と同じ形に揃えた）。

## 検証

**実際に出どころの JSDoc へ日本語を入れて生成し、検査が落ちることを確かめた**（実測）:

```text
公開 API リファレンスに日本語（かな）が混ざっています。
公開サーフェスの JSDoc は英語です（CLAUDE.md）。**生成物ではなく出どころの JSDoc** を直してください:

  type-aliases/Option.md:13: ひらがなを一時的に混ぜる。A decoded Option (one choice). …
```

合成入力に対する試験は `scripts/check-api-reference.test.mjs`（7 ケース）:
ひらがな・カタカナ・長音符を拾い、複数ファイル / 複数行をすべて挙げ、行番号は 1 始まり。

**漢字を拾わないことも試験で固定した。** ADR の節番号（`案5b` / `論点4`）は
**日本語 ADR の節を指す引用キー**で、英訳すると参照先を辿れなくなる。日本語のサンプル値
（`面談`）も同様。ここを弾くと「直しようのない指摘」になるので、意図的に対象外にしている。

> **追記（2026-09-21・#363 以降）**: 前提が変わった。ADR 番号もその節番号も**利用者には意味を
> 持たない**ので、公開 JSDoc には書かず `//` の実装コメントへ移す方針になり、`check:api` は
> かな検査に加えて保守者向けの識別子（`ADR-` / `RV-` / `LV-` / `SD-n` / `案n` 等）も弾く。
> 「引用キーだから残す」ではなく「引用そのものを JSDoc に置かない」。漢字を拾わない判断は
> サンプル値（`面談`）のためだけに残っている。

実測: 生成物の日本語（かな）は **0 件**。`pnpm check:api` は
`API リファレンスは最新です（187 ファイル・日本語の混入なし）` を出す。

品質ゲートは全 green（**1294 tests**）。

[adr68]: ../../adr/0068-api-reference-tooling.md
[rv30]: 0030-generic-constraint-types-unexported.md
[rv42]: 0042-quality-gate-list-drift.md
