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
// 漢字ではなく**かな・カタカナだけ**を見る。日本語のサンプル値（`P_Title: "面談"`）は漢字で
// 現れうるので、漢字まで弾くと誤検知になる（判断は RV-51 を参照）。
//
// 同じ理由で**保守者向けの識別子**（ADR / RV / LV 番号・VERIFY(live)・docs/adr 等のパス）も
// 生成物側で弾く。利用者には意味を持たない情報で、IDE のホバーと docs/usage/api にそのまま
// 出る。根拠は JSDoc ではなく `//` の実装コメントに書く（エラーの message / hint と同じ規律）。
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

// 保守者向けの識別子。ADR / レビュー指摘（RV）/ 実機確認項目（LV）の番号、VERIFY(live) の印、
// 設計文書の節番号、そして `docs/usage/` 以外の `docs/` パス。
//
// - 節番号は ADR 番号に添えられずに単独で現れることがある（`PhaseAccessor` の `(案5b)` は
//   実際に生成物に出ていた形で、#363 では手で外した）。ASCII の `SD-n` / `F-n`（基本設計の節・機能番号）と
//   漢字＋数字の `案n` / `論点n` / `決定n`（ADR の節）は、どちらも生成物に出る日本語の
//   サンプル値（`面談` のような語）と衝突しないので拾う。かな検査が漢字を対象外にした隙間を
//   ここで埋める形。
// - `docs/` は allowlist で見る。利用者が読むのは `docs/usage/` だけで、それ以外
//   （adr / reviews / design / history / runbook）は保守者向け。denylist だと新しい
//   保守者向けディレクトリが黙って通る。ただし**このリポジトリのパスに限る**: 素の `docs/` を
//   拾うと、typedoc が `Error` から継承して描く `https://v8.dev/docs/stack-trace-api` のような
//   外部 URL に当たる（#363 の修正を通し直したときに実際に落ちた）。パスの先頭（行頭・空白・
//   引用符・括弧の直後、`../` 付きも可）か、この repo の GitHub URL の中だけを見る。
//   `docs/README.md` だけは通す: 「読む人／作る人」の分岐点で、利用者向け文書が開発者向け
//   資料へ案内する唯一の入口（README と docs/usage/index.md が指す）。
// - `CLAUDE.md`（Claude Code 向けの規約）と `SPEC_v1`（superseded の素案）は内部ファイルの
//   名前で、利用者向け文書に出ても意味を持たない。手書きの利用者向け文書に実際に混ざっていた形。
const REPO_DOCS =
  /(?<![\w./-])(?:\.\.\/)*docs\/(?!usage\b|README\.md\b)|porters-connect\/(?:blob|tree|raw)\/[^\s/]+\/docs\/(?!usage\b|README\.md\b)/;
const MAINTAINER_ID = new RegExp(
  [
    /\bADR-\d{4}/,
    /\bRV-\d+\b/,
    /\bLV-\d+\b/,
    /\bSD-\d+\b/,
    /\bF-\d+\b/,
    /(?:案|論点|決定)\d/,
    /VERIFY\(live\)/,
    /\bCLAUDE\.md\b/,
    /\bSPEC_v1\b/,
    REPO_DOCS,
  ]
    .map((r) => r.source)
    .join("|"),
);

/**
 * 生成物に保守者向けの識別子が混ざっている行を拾う。`tree` は readTree の結果
 * （相対パス -> 内容）。返り値は `path:line: 内容` の配列。
 */
export const maintainerIdLines = (tree) => {
  const found = [];
  for (const [path, content] of tree) {
    content.split("\n").forEach((line, i) => {
      if (MAINTAINER_ID.test(line))
        found.push(`${path}:${String(i + 1)}: ${line.trim()}`);
    });
  }
  return found;
};

// 生成と比較の本体。CLI として実行されたときだけ走らせる（テストからは import して
// `kanaLines` / `maintainerIdLines` を呼ぶ — import しただけで typedoc が動くと検査の
// テストが書けない）。
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
      const ids = maintainerIdLines(actual);
      if (ids.length > 0) {
        console.error(
          "公開 API リファレンスに保守者向けの識別子（ADR / RV / LV 番号など）が混ざっています。\n" +
            "利用者には意味を持たない情報です。根拠は JSDoc ではなく `//` の実装コメントに移してください:\n",
        );
        for (const l of ids.slice(0, 20)) console.error(`  ${l}`);
        if (ids.length > 20)
          console.error(`  … 他 ${String(ids.length - 20)} 件`);
        process.exit(1);
      }
      console.log(
        `API リファレンスは最新です（${String(expected.size)} ファイル・日本語と保守者向け識別子の混入なし）。`,
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
