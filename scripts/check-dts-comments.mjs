#!/usr/bin/env node
// 公開する型定義 `dist/index.d.ts` に載る JSDoc が、公開サーフェスの規約
// （英語・保守者向けの識別子を書かない）を守っているかの検査。
//
// なぜ `check:api` と別に要るか: `check:api` は typedoc の生成物 `docs/usage/api` を見るが、
// typedoc は **`src/index.ts` から export された記号しか描画しない**。公開型から参照される
// だけの型（`Resource` の各メソッド、`CreateInput`、`Without` …。ADR-0068 決定4 で「当面は
// 警告のまま」としている 60 件）は生成物に出ないのに、tsup が束ねる d.ts には JSDoc ごと
// 載り、IDE のホバーで利用者に見える。#363 のレビューで実測したところ、d.ts の 273 ブロック
// 中 43 ブロックがこの状態で、`t.candidate.get(...)` のホバーに出る文もここに含まれていた。
// `check:api` だけでは、そこへ `(ADR-…)` が戻っても緑のまま＝黙って通る。
//
// 検査そのものは `check-api-reference.mjs` の `kanaLines` / `maintainerIdLines` をそのまま
// 使う（規則を 2 箇所に持たない）。違うのは**どの生成物を見るか**だけ。
//
// 使い方: `pnpm build` の後に `pnpm check:dts`。`check:publish` / `check:cjs` と同じく dist を
// 見るので、`pnpm check`（束ね）には**入れていない**。dist が無ければ落とす（「無いので何も
// 見なかった」を緑にしない）。`dist/index.d.cts` は `.d.ts` の byte 単位の写し
// （`emit-cts-types.mjs`）なので片方だけ見る。

import { existsSync, readFileSync } from "node:fs";

import { kanaLines, maintainerIdLines } from "./check-api-reference.mjs";

const DTS = "dist/index.d.ts";

/**
 * d.ts の内容を検査し、規約に反する行を返す。`kana` は日本語（かな）の行、`ids` は
 * 保守者向けの識別子の行。どちらも `path:line: 内容` の配列。
 */
export const dtsFindings = (content, path = DTS) => {
  const tree = new Map([[path, content]]);
  return { kana: kanaLines(tree), ids: maintainerIdLines(tree) };
};

const report = (label, lines) => {
  console.error(label);
  for (const l of lines.slice(0, 20)) console.error(`  ${l}`);
  if (lines.length > 20)
    console.error(`  … 他 ${String(lines.length - 20)} 件`);
};

const main = () => {
  if (!existsSync(DTS)) {
    console.error(
      `✖ ${DTS} がありません。先に \`pnpm build\` を走らせてください。`,
    );
    process.exit(1);
  }
  const { kana, ids } = dtsFindings(readFileSync(DTS, "utf8"));
  if (kana.length > 0) {
    report(
      "公開する型定義の JSDoc に日本語（かな）が混ざっています。公開サーフェスの JSDoc は英語です（CLAUDE.md）:\n",
      kana,
    );
  }
  if (ids.length > 0) {
    report(
      "公開する型定義の JSDoc に保守者向けの識別子（ADR / RV / LV 番号など）が混ざっています。\n" +
        "利用者には意味を持たない情報です。根拠は JSDoc ではなく `//` の実装コメントに移してください:\n",
      ids,
    );
  }
  if (kana.length > 0 || ids.length > 0) process.exit(1);
  console.log(
    `公開する型定義の JSDoc は規約どおりです（${DTS}・日本語と保守者向け識別子の混入なし）。`,
  );
};

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split("/").pop())
) {
  main();
}
