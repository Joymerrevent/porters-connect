#!/usr/bin/env node
// 公開する **CJS の入口を実際に叩く**検査（[ADR-0082]）。
//
// なぜ要るか: 0.18.0 までの `exports` は `import` 条件しか持たず、CJS 利用者は
// `require()` で `ERR_PACKAGE_PATH_NOT_EXPORTED`、TypeScript（`moduleResolution: node16`）で
// `TS1479` になっていた。**誰も叩いていなかったから 0.18.0 まで残った。**
// ADR-0082 は `require` 条件を**同じ ESM 実体**に向ける形（Node の `require(esm)`）に賭けている。
// 賭けが外れたときに気づけるよう、静的な検査ではなく**実行**で確かめる。
//
// attw はこの形を FalseCJS と報告するので `check:publish` では ignore している
// （attw は Node の `require(esm)` を織り込まず「dynamic import only」と判定する）。
// **落とした静的判定の代わりがこの検査**＝ここを外すと誰も入口を見なくなる。
//
// 何を確かめるか:
//   (1) `require()` が通り、名前付き export が見えること（＝ `require` 条件が生きている）
//   (2) `require` と `import` が**同じクラス**を返すこと。ESM 側の
//       `catch (e) { if (e instanceof PortersError) … }` が CJS 側で起きたエラーを捕まえる
//       ＝ [ADR-0006] のエラーモデルの前提。別実体を配ると、ここが `false` に落ちる
//   (3) CJS の TypeScript 利用者（`module: node16`）がコンパイルできること（＝ `.d.cts` が効く）
//
// どう確かめるか: 一時ディレクトリに `"type": "commonjs"` のプロジェクトを作り、
// `node_modules/@joymerrevent/porters-connect` からリポジトリへ symlink を張る。
// 解決は `exports` を通る＝**利用者と同じ経路**になる（tarball を作って install するより速い）。
//
// 使い方: `pnpm build` の後に `pnpm check:cjs`。`check:publish` と同じく dist を見るので、
// `pnpm check`（束ね）には**入れていない**。
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = process.cwd();
const PKG = "@joymerrevent/porters-connect";

// dist が無いまま「通った」と言わないための入口ガード（fail-open 防止）。
for (const f of ["dist/index.js", "dist/index.d.cts"]) {
  if (existsSync(join(REPO, f))) continue;
  console.error(
    `✖ ${f} がありません。先に \`pnpm build\` を走らせてください。`,
  );
  process.exit(1);
}

const fail = (...lines) => {
  console.error("✖ CJS の入口が壊れています（ADR-0082）:");
  for (const l of lines) console.error(l);
  process.exit(1);
};

const scratch = mkdtempSync(join(tmpdir(), "porters-cjs-entry-"));
try {
  // 利用者のプロジェクトを模す。`"type": "commonjs"` ＝ .js も .ts も CJS として扱われる。
  writeFileSync(
    join(scratch, "package.json"),
    JSON.stringify(
      { name: "cjs-entry-check", private: true, type: "commonjs" },
      null,
      2,
    ),
  );
  mkdirSync(join(scratch, "node_modules/@joymerrevent"), { recursive: true });
  symlinkSync(REPO, join(scratch, "node_modules", PKG), "dir");

  // (1)(2) 実行時。require の結果と import の結果が同じクラスかまで見る。
  writeFileSync(
    join(scratch, "entry.js"),
    `const cjs = require(${JSON.stringify(PKG)});

const must = (ok, message) => {
  if (!ok) {
    console.error(message);
    process.exit(1);
  }
};

must(typeof cjs.PortersClient === "function", "require() の結果に PortersClient がありません。");
must(typeof cjs.PortersError === "function", "require() の結果に PortersError がありません。");

import(${JSON.stringify(PKG)}).then((esm) => {
  must(
    esm.PortersError === cjs.PortersError,
    "require と import で PortersError が別物です（実体が 2 つ読まれています）。",
  );
  // ADR-0006 のエラーモデルは instanceof の分岐に立っている。またげることを直接確かめる。
  const e = new cjs.PortersConfigError("cjs entry check", { category: "config" });
  must(
    e instanceof esm.PortersError,
    "CJS 側で作ったエラーが ESM 側の instanceof PortersError を通りません。",
  );
});
`,
  );

  try {
    execFileSync(process.execPath, ["entry.js"], {
      cwd: scratch,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    fail(
      "  入口を叩く実行が失敗しました（`require()` そのものか、上の検査のどれか）。出力:",
      String(e.stdout ?? ""),
      String(e.stderr ?? ""),
    );
  }

  // (3) 型。CJS の利用者が書く形（`module: node16`）でコンパイルできるか。
  writeFileSync(
    join(scratch, "consumer.ts"),
    `import { PortersClient, type PortersClientOptions } from ${JSON.stringify(PKG)};\n` +
      'const options: PortersClientOptions = { hostname: "example.invalid", appId: "a", appSecret: "s" };\n' +
      "export const client = new PortersClient(options);\n",
  );
  // ハーネス自身の検査。tsc が実際に解決して型を読んでいるなら、これは**必ず**落ちる。
  // 落ちなかったら「検査が走っていない」ので、consumer の緑は信用できない。
  writeFileSync(
    join(scratch, "canary.ts"),
    `import { __NotExported__ } from ${JSON.stringify(PKG)};\nexport const x = __NotExported__;\n`,
  );
  writeFileSync(
    join(scratch, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          // CJS 利用者の設定。`.d.ts`（ESM）を require 条件に置くと、ここで TS1479 になる。
          module: "node16",
          moduleResolution: "node16",
          target: "es2022",
          lib: ["es2023"],
          noEmit: true,
          skipLibCheck: true,
          types: ["node"],
          // 一時ディレクトリはリポジトリの外なので @types をここから辿れない。
          // 指定しないと TS2688 で**検査が始まる前に**落ち、per-file の結果が空になる。
          typeRoots: [join(REPO, "node_modules/@types")],
        },
        include: ["*.ts"],
      },
      null,
      2,
    ),
  );

  // `--listFiles` で「どの型定義を読んだか」まで出させる。`consumer.ts` が緑でも、
  // `import` 条件の `.d.ts` を読んで通っているなら **CJS の経路は検査できていない**。
  let raw = "";
  try {
    raw = String(
      execFileSync("tsc", ["-p", scratch, "--listFiles"], {
        cwd: REPO,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  } catch (e) {
    // tsc が起動できないのと、tsc が型エラーを報告したのは**別物**。混ぜると
    // 「検査が走っていない」を「型エラーが無い」と読み違える。
    if (e.code === "ENOENT")
      fail("  tsc を起動できません（`pnpm check:cjs` から実行してください）。");
    raw = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  const lines = raw.split("\n").map((l) => l.replaceAll("\\", "/"));
  const erroredIn = (name) =>
    lines.some((l) =>
      new RegExp(`(?:^|/)${name}\\.ts\\(\\d+,\\d+\\):`).test(l),
    );

  if (!lines.some((l) => l.trim().endsWith("/dist/index.d.cts")))
    fail(
      "  tsc が `dist/index.d.cts` を読んでいません（`require` 条件の types が効いていない）。",
      "  tsc の出力:",
      lines.filter((l) => l.includes("/dist/")).join("\n"),
    );

  if (!erroredIn("canary"))
    fail(
      "  検査が壊れています: **必ず型エラーになるはずの import が通りました**。",
      "  tsc が型を読めていない可能性があります（このままでは consumer も素通りします）。tsc の出力:",
      lines.slice(0, 12).join("\n"),
    );
  if (erroredIn("consumer"))
    fail(
      "  CJS の TypeScript 利用者（module: node16）がコンパイルできません。tsc の出力:",
      lines.filter((l) => l.includes("consumer.ts")).join("\n"),
    );

  console.log(
    "✓ CJS の入口 OK（require 実行 / instanceof が ESM をまたぐ / node16 で型解決）",
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
