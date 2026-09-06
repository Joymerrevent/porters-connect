#!/usr/bin/env node
// シェルコードの `$var` の直後に非 ASCII 文字が続く箇所を検出する。
//
// なぜ要るか: bash は `$state）` の `）`（U+FF09）を変数名の一部として読む。結果 `state）`
// という未定義変数を参照し、`set -u` の下ではその場でスクリプトが終了する。
// 日本語のメッセージを書くと自然に生まれる形で、実際に本リポジトリで 2 度発生した。
//
// 質が悪いのは壊れ方で、多くの場合これは**エラーメッセージを出す行**に現れる。
// つまり「異常を報告しようとした瞬間に、報告せず死ぬ」＝黙って正常終了したように見える。
// 安全側の経路が選択的に壊れるので、テストが緑でも気づけない。
//
// 対象は `.sh` と、`.github/workflows/` の YAML（`run:` ブロックは同じ bash で、
// 同じ壊れ方をする）。`.sh` だけを見ていると、ワークフローに直接書いた数行が検査から漏れる。
//
// 直し方は `${var}` と括るだけ。人の記憶ではなく検査で守る（MD054 で参照スタイルを
// 強制しているのと同じ発想）。
//
// 使い方: `pnpm check:shell`（CI では常時実行ブロックに置く。パスフィルタ配下だと
// シェルだけ変えた PR で走らないことがあり、検査が形だけになる）。

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
]);

/** ワークフロー YAML を対象に含める場所。ここの `run:` は bash で走る。 */
const WORKFLOW_DIR = join(".github", "workflows");

/** `$name` の直後が非 ASCII のときだけ拾う。`${name}` と書けば安全なので対象外。 */
export const OFFENDING = /\$[A-Za-z_][A-Za-z0-9_]*(?=\P{ASCII})/gu;

/** 検査対象のファイルか（`.sh`、または `.github/workflows/` 配下の YAML）。 */
export const isTarget = (path, name) =>
  name.endsWith(".sh") ||
  ((name.endsWith(".yml") || name.endsWith(".yaml")) &&
    path.includes(WORKFLOW_DIR));

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

/** 対象ファイルを列挙する（深さ優先・SKIP_DIRS は降りない）。 */
export const collectTargets = (dir = ".", read = { readdirSync, statSync }) => {
  const found = [];
  for (const name of read.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (read.statSync(full).isDirectory()) {
      found.push(...collectTargets(full, read));
    } else if (isTarget(full, name)) {
      found.push(full);
    }
  }
  return found;
};

export const checkAll = (dir = ".", read = readFileSync) =>
  collectTargets(dir).flatMap((p) => checkSource(p, read(p, "utf8")));

// CLI として実行されたときだけ走らせる（テストからは import して関数を呼ぶ）。
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const problems = checkAll();
  if (problems.length > 0) {
    console.error(
      "シェルコードに、全角文字が変数名へ吸われる箇所があります:\n",
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
  console.log("シェルコードの変数参照は安全です。");
}
