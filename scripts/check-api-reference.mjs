#!/usr/bin/env node
// docs/api（TypeDoc の生成物）が今のソースと一致しているかの検査（ADR-0068 決定3）。
//
// なぜ要るか: 生成物をリポジトリに置く方式（案B）の値打ちは「公開 API を変えると
// リファレンスの差分が PR に出る」ことで、**生成し忘れるとその値打ちが消える**。人の注意に
// 頼らず、忘れたら落ちる形にする（`pnpm check:index` と同じ発想）。
//
// なぜ `git diff --exit-code` ではないか: ADR は差分検査と書いているが、素の git diff だと
// **作業ツリーが汚れていると誤検知**し、検査のために docs/api を書き換えてしまう。ここでは
// 一時ディレクトリへ生成して**中身を突き合わせる**ので、検査は副作用を持たない。
// 検出したい事象（生成物がソースと食い違う）は同じ。
//
// 使い方: `pnpm check:api`。落ちたら `pnpm docs:api` で再生成してコミットする。

import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

const COMMITTED = "docs/usage/api";

/** 相対パス -> 内容。ディレクトリを丸ごと読む（比較のため）。 */
const readTree = (root) => {
  const out = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      // パス区切りを揃える（比較する 2 つのツリーで同じ形にする）。
      out.set(
        relative(root, full).split(sep).join("/"),
        readFileSync(full, "utf8"),
      );
    }
  };
  walk(root);
  return out;
};

const exists = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

if (!exists(COMMITTED)) {
  console.error(
    `${COMMITTED} がありません。\`pnpm docs:api\` で生成してコミットしてください。`,
  );
  process.exit(1);
}

const scratch = mkdtempSync(join(tmpdir(), "porters-api-ref-"));
try {
  // `out` だけ差し替えて生成する。他の設定は typedoc.json のものを使う＝
  // 検査と `pnpm docs:api` が同じ設定で走る（片方だけ変わることがない）。
  execFileSync("typedoc", ["--out", scratch], {
    stdio: ["ignore", "ignore", "inherit"],
    preferLocal: true,
    shell: false,
    env: process.env,
  });

  const expected = readTree(scratch);
  const actual = readTree(COMMITTED);

  const missing = [...expected.keys()].filter((p) => !actual.has(p));
  const extra = [...actual.keys()].filter((p) => !expected.has(p));
  const changed = [...expected.keys()].filter(
    (p) => actual.has(p) && actual.get(p) !== expected.get(p),
  );

  if (missing.length === 0 && extra.length === 0 && changed.length === 0) {
    console.log(
      `API リファレンスは最新です（${String(expected.size)} ファイル）。`,
    );
    process.exit(0);
  }

  console.error("API リファレンスがソースと食い違っています。");
  const report = (label, list) => {
    if (list.length === 0) return;
    console.error(`\n${label}（${String(list.length)} 件）:`);
    for (const p of list.slice(0, 20)) console.error(`  ${p}`);
    if (list.length > 20)
      console.error(`  … 他 ${String(list.length - 20)} 件`);
  };
  report("生成されるのに commit されていない", missing);
  report("commit されているのに生成されない", extra);
  report("内容が違う", changed);
  console.error("\n`pnpm docs:api` で再生成し、差分をコミットしてください。");
  process.exit(1);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
