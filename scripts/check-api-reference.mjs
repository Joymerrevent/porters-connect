#!/usr/bin/env node
// docs/usage/api（TypeDoc の生成物）が今のソースと一致しているかの検査（ADR-0068 決定3）。
//
// なぜ要るか: 生成物をリポジトリに置く方式（案B）の値打ちは「公開 API を変えると
// リファレンスの差分が PR に出る」ことで、**生成し忘れるとその値打ちが消える**。人の注意に
// 頼らず、忘れたら落ちる形にする（`pnpm check:index` と同じ発想）。
//
// なぜ `git diff --exit-code` ではないか: ADR は差分検査と書いているが、素の git diff だと
// **作業ツリーが汚れていると誤検知**し、検査のために docs/usage/api を書き換えてしまう。ここでは
// 一時ディレクトリへ生成して**中身を突き合わせる**ので、検査は副作用を持たない。
// 検出したい事象（生成物がソースと食い違う）は同じ。
//
// あわせて**生成物に日本語（かな）が混ざっていないか**も見る（RV-51）。公開サーフェスの JSDoc は
// 英語という規約（CLAUDE.md）に対して、生成物は最も公開サーフェスらしい成果物なのに、
// 実測で 187 頁中 4 頁に混入していた。**生成物側を見る**のが要点で、`src` を直接 grep すると
// 内部実装コメント（日本語可）と区別が付かない — 生成物に出たものは定義上すべて公開 JSDoc。
//
// 漢字ではなく**かな・カタカナだけ**を見る。ADR の節番号（`案5b` / `論点4`）や日本語の
// サンプル値は漢字で現れうるので、漢字まで弾くと誤検知になる（判断は RV-51 を参照）。
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

// ひらがな・カタカナ（長音符を含む）。漢字は意図的に含めない — 上の説明を参照。
const KANA = /[\u3041-\u309F\u30A0-\u30FF]/;

/**
 * 生成物に日本語（かな）が混ざっている行を拾う。`tree` は readTree の結果
 * （相対パス -> 内容）。返り値は `path:line: 内容` の配列。
 */
export const kanaLines = (tree) => {
  const found = [];
  for (const [path, content] of tree) {
    content.split("\n").forEach((line, i) => {
      if (KANA.test(line))
        found.push(`${path}:${String(i + 1)}: ${line.trim()}`);
    });
  }
  return found;
};

// 生成と比較の本体。CLI として実行されたときだけ走らせる（テストからは import して
// `kanaLines` を呼ぶ — import しただけで typedoc が動くと検査のテストが書けない）。
const main = () => {
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
      // 生成物が最新であることと、そこに日本語が無いことは別の問題。前者が通ってから見る
      // （古い生成物の日本語を報告しても、再生成で消えるかもしれない）。
      const kana = kanaLines(actual);
      if (kana.length > 0) {
        console.error(
          "公開 API リファレンスに日本語（かな）が混ざっています。\n" +
            "公開サーフェスの JSDoc は英語です（CLAUDE.md）。**生成物ではなく出どころの JSDoc** を直してください:\n",
        );
        for (const l of kana.slice(0, 20)) console.error(`  ${l}`);
        if (kana.length > 20)
          console.error(`  … 他 ${String(kana.length - 20)} 件`);
        process.exit(1);
      }
      console.log(
        `API リファレンスは最新です（${String(expected.size)} ファイル・日本語の混入なし）。`,
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
};

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split("/").pop())
) {
  main();
}
