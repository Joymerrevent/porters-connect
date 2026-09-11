#!/usr/bin/env node
// Markdown のリンク先が実在するかの検査。
//
// なぜ要るか: markdownlint の MD052 は「**ラベルが未定義**」を見るだけで、
// **リンク先のファイルがあるか**は見ない。つまり `[x]: ./gone.md` は lint を通る。
// このセッションで手動チェックを 2 回走らせ、**2 回とも実際に壊れたリンクが出た**
// （ADR-0070 の移設で 7 本／兄弟ファイル間の相対リンク）。人がやると忘れるので機械に渡す。
//
// 何を見るか: 参照スタイルの定義（`[label]: path`）と inline の相対リンク（`](./path)`）。
// 外部 URL とページ内アンカー（`#…`）は対象外。アンカー付きのパスはファイル部分だけ見る。
//
// 使い方: `pnpm check:links`

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

// 生成物と、リポジトリの文書ではないもの。`docs/api` は TypeDoc の出力（`pnpm check:api` が見る）。
const SKIP_PREFIXES = ["docs/api/", ".claude/"];

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => f.endsWith(".md"))
  .filter((f) => !SKIP_PREFIXES.some((p) => f.startsWith(p)));

/** 1 ファイル分のリンク先（行番号つき）。 */
const linksOf = (file) => {
  const out = [];
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const push = (target) => out.push({ target, line: i + 1 });
      // 参照スタイルの定義: `[label]: target`
      const def = /^\[[^\]]+\]:\s*(\S+)\s*$/.exec(line);
      if (def) push(def[1]);
      // inline の相対リンク: `](./x.md)` / `](../x.md)`
      for (const m of line.matchAll(/\]\((\.{1,2}\/[^)\s]+)\)/g)) push(m[1]);
    });
  return out;
};

const problems = [];
for (const file of tracked) {
  for (const { target, line } of linksOf(file)) {
    // 外部・アンカーのみ・プロトコル相対は対象外
    if (/^(https?:|mailto:|#|\/\/)/.test(target)) continue;
    const path = target.split("#")[0];
    if (path === "") continue; // 同一ページ内アンカー
    const resolved = normalize(join(dirname(file), path));
    if (!existsSync(resolved)) {
      problems.push(`${file}:${String(line)} -> ${target}`);
    }
  }
}

if (problems.length === 0) {
  console.log(
    `リンク先はすべて実在します（${String(tracked.length)} ファイルを検査）。`,
  );
  process.exit(0);
}

console.error(`リンク先が見つかりません（${String(problems.length)} 件）:\n`);
for (const p of problems) console.error(`  ${p}`);
console.error(
  "\nファイルを移したなら参照元も直してください（`git mv` はリンクを直しません）。",
);
process.exit(1);
