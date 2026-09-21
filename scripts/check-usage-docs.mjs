#!/usr/bin/env node
// 利用者向けの手書きドキュメント（`docs/usage/**` の生成物以外と `README.md`）に、保守者向けの
// 識別子（ADR / RV / LV 番号など）や保守者向け文書へのリンクが混ざっていないかの検査。
//
// `check:api` / `check:dts` は**生成物**（typedoc の出力・配布する d.ts）を見る。利用者が読む
// もう 1 つの経路が手書きの `docs/usage/` と README で、こちらは 25 ファイル・139 箇所に
// `（ADR-0059）` のような出典表示が付いていた。出典は保守者と AI が「この記述はどの決定に
// 由来するか」を辿るためのもので、利用者には意味を持たない。**HTML コメント**（`<!-- 根拠: ADR-0059 -->`）
// に移せば、GitHub の表示では消え、ソースを読む側には残る。この検査はコメントを剥がしてから
// 本文を見る＝コメントの中は何を書いてもよい。
//
// リンクも見る。本文に番号が無くても `[設計][bd]` → `../../design/basic-design.md` のように
// 保守者向け文書へ送る形が残るため。利用者向け文書からリンクしてよい `docs/usage/` の外は
// allowlist（`LINKABLE_OUTSIDE`）で持つ: 「読む人／作る人」の分岐点 `docs/README.md` と、
// リポジトリを clone した利用者が使うフェイクサーバーの手順書だけ。denylist だと新しい
// 保守者向けディレクトリが黙って通る。
//
// 検査そのものは `check-api-reference.mjs` の `maintainerIdLines` をそのまま使う
// （規則を 2 箇所に持たない）。違うのは**どのファイルを、コメントを剥がして見るか**だけ。
//
// 使い方: `pnpm check:usage`（`pnpm check` に含まれる）。

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { maintainerIdLines } from "./check-api-reference.mjs";

/** 利用者向けの手書き文書の置き場。ディレクトリは再帰、ファイルはそのまま。 */
export const USER_DOC_ROOTS = ["docs/usage", "README.md"];

/** `docs/usage/` の中で生成物（`check:api` が見る）。ここでは見ない。 */
export const GENERATED = "docs/usage/api";

/**
 * 利用者向け文書からリンクしてよい、`docs/usage/` の外のファイル（リポジトリ相対）。
 * ルート直下の公開物と、開発者向け資料への唯一の入口、clone した利用者向けの手順書。
 */
export const LINKABLE_OUTSIDE = new Set([
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  ".env.example",
  "docs/README.md",
  "docs/fake-server-runbook.md",
]);

/**
 * HTML コメントを消す。行数は変えない（複数行のコメントは同じ数の改行に置き換える）ので、
 * 報告する行番号が元のファイルと一致する。
 */
export const stripComments = (content) =>
  content.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ""));

/**
 * 利用者向け文書を集める。返り値は `readTree` と同じ形（リポジトリ相対パス -> 内容）。
 * `root` はリポジトリのルート。
 */
export const readUserDocs = (root) => {
  const out = new Map();
  const add = (full) => {
    const rel = relative(root, full).split(sep).join("/");
    if (rel === GENERATED || rel.startsWith(`${GENERATED}/`)) return;
    if (!rel.endsWith(".md")) return;
    out.set(rel, readFileSync(full, "utf8"));
  };
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else add(full);
    }
  };
  for (const r of USER_DOC_ROOTS) {
    const full = join(root, r);
    if (statSync(full).isDirectory()) walk(full);
    else add(full);
  }
  return out;
};

/** 本文（コメントを除く）に保守者向けの識別子がある行。`path:line: 内容` の配列。 */
export const idFindings = (tree) =>
  maintainerIdLines(
    new Map([...tree].map(([path, content]) => [path, stripComments(content)])),
  );

// リンク先の取り出し。参照定義 `[label]: target` と、inline `[text](target)`（規約では
// 使わないが、書かれたら見る）。autolink `<https://…>` は外部なので対象外。
const LINK_TARGETS = /^\[[^\]]+\]:\s*(\S+)|\]\(([^)\s]+)\)/g;

/**
 * 保守者向け文書へのリンクがある行。`path:line: target → 解決先` の配列。
 * 外部 URL は見ない（この repo の GitHub URL は `maintainerIdLines` が拾う）。
 */
export const linkFindings = (tree) => {
  const found = [];
  for (const [path, content] of tree) {
    stripComments(content)
      .split("\n")
      .forEach((line, i) => {
        for (const m of line.matchAll(LINK_TARGETS)) {
          const target = m[1] ?? m[2];
          if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#"))
            continue;
          const file = target.split("#")[0];
          if (file === "") continue;
          // リポジトリ相対に正規化（`resolve` は絶対パスにするので、ルートを `/` に固定する）
          const resolved = relative("/", resolve("/", dirname(path), file))
            .split(sep)
            .join("/");
          if (resolved.startsWith("docs/usage/")) continue;
          if (LINKABLE_OUTSIDE.has(resolved)) continue;
          found.push(`${path}:${String(i + 1)}: ${target} → ${resolved}`);
        }
      });
  }
  return found;
};

const report = (label, lines) => {
  console.error(label);
  for (const l of lines.slice(0, 20)) console.error(`  ${l}`);
  if (lines.length > 20)
    console.error(`  … 他 ${String(lines.length - 20)} 件`);
  console.error("");
};

const main = () => {
  const tree = readUserDocs(process.cwd());
  const ids = idFindings(tree);
  const links = linkFindings(tree);
  if (ids.length > 0) {
    report(
      "利用者向けドキュメントに保守者向けの識別子（ADR / RV / LV 番号など）が混ざっています。\n" +
        "利用者には意味を持たない情報です。出典は HTML コメント（`<!-- 根拠: ADR-0059 -->`）に移してください:\n",
      ids,
    );
  }
  if (links.length > 0) {
    report(
      "利用者向けドキュメントから保守者向け文書へリンクしています。\n" +
        "利用者に必要な内容は本文に書き、出典は HTML コメントに移してください（開発者向け資料への入口は docs/README.md だけ）:\n",
      links,
    );
  }
  if (ids.length > 0 || links.length > 0) process.exit(1);
  console.log(
    `利用者向けドキュメントは規約どおりです（${String(tree.size)} ファイル・保守者向け識別子とリンクの混入なし）。`,
  );
};

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split("/").pop())
) {
  main();
}
