#!/usr/bin/env node
// シェルスクリプトの `$var` の直後に非 ASCII 文字が続く箇所を検出する。
//
// なぜ要るか: bash は `$state）` の `）`（U+FF09）を変数名の一部として読む。結果 `state）`
// という未定義変数を参照し、`set -u` の下ではその場でスクリプトが終了する。
// 日本語のメッセージを書くと自然に生まれる形で、実際に本リポジトリで 2 度発生した。
//
// 質が悪いのは壊れ方で、多くの場合これは**エラーメッセージを出す行**に現れる。
// つまり「異常を報告しようとした瞬間に、報告せず死ぬ」＝黙って正常終了したように見える。
// 安全側の経路が選択的に壊れるので、テストが緑でも気づけない。
//
// 直し方は `${var}` と括るだけ。人の記憶ではなく検査で守る（MD054 で参照スタイルを
// 強制しているのと同じ発想）。
//
// 使い方: `pnpm check:shell`（CI では常時実行ブロックに置く。パスフィルタ配下だと
// シェルだけ変えた PR で走らないことがあり、検査が形だけになる）。

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
]);

/** `$name` の直後が非 ASCII のときだけ拾う。`${name}` と書けば安全なので対象外。 */
export const OFFENDING = /\$[A-Za-z_][A-Za-z0-9_]*(?=\P{ASCII})/gu;

/** 1 ファイル分の中身を検査して、見つかった箇所を返す。 */
export const checkSource = (path, source) => {
  const problems = [];
  source.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(OFFENDING)) {
      problems.push({
        path,
        line: i + 1,
        found: m[0],
        suggestion: `\${${m[0].slice(1)}}`,
        text: line.trim(),
      });
    }
  });
  return problems;
};

/** 対象となる .sh を列挙する（深さ優先・SKIP_DIRS は降りない）。 */
export const collectShellFiles = (
  dir = ".",
  read = { readdirSync, statSync },
) => {
  const found = [];
  for (const name of read.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (read.statSync(full).isDirectory()) {
      found.push(...collectShellFiles(full, read));
    } else if (name.endsWith(".sh")) {
      found.push(full);
    }
  }
  return found;
};

export const checkAll = (dir = ".", read = readFileSync) =>
  collectShellFiles(dir).flatMap((p) => checkSource(p, read(p, "utf8")));

// CLI として実行されたときだけ走らせる（テストからは import して関数を呼ぶ）。
if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split("/").pop())
) {
  const problems = checkAll();
  if (problems.length > 0) {
    console.error(
      "シェルスクリプトに、全角文字が変数名へ吸われる箇所があります:\n",
    );
    for (const p of problems) {
      console.error(`  ${p.path}:${p.line}  ${p.found} → ${p.suggestion}`);
      console.error(`    ${p.text}`);
    }
    console.error(
      "\n`${var}` と括ってください。bash は直後の非 ASCII 文字を変数名の一部として読み、" +
        "`set -u` の下では未定義変数としてその場で終了します。",
    );
    process.exit(1);
  }
  console.log("シェルスクリプトの変数参照は安全です。");
}
