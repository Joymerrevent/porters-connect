#!/usr/bin/env node
// ドキュメント内の TypeScript コード例が今の公開 API でコンパイルするかの検査
// （[ADR-0070] 論点4 の検査④）。
//
// なぜ要るか: 実測（2026-09-10）では **58 個のコード例のうち検査されているものが 0 個**で、
// `new PortersClient({ …, partition })` は 0.10.0 で `partition` を外して以来 **19 日間**
// 壊れたままだった。しかも壊れていたファイルの 1 つはその間に更新されている——
// **別の節を直しても、離れた場所の古い例は誰も見ない**。だから人ではなく機械に見せる。
//
// どう検査するか: 各コードブロックを**独立した 1 モジュール**として型検査する。文書順に
// 連結する案も試したが、ドキュメントは節ごとに同じ名前を再定義するので再宣言エラーが
// 大量に出た（実測 67 件）＝ブロック単位の分離が実態に合う。
//
// 断片への対処: 本文のコード例は `t` や `porters` を宣言せずに使う（説明の都合で当然）。
// そこで**公開 API の全記号と、慣例的な名前**を ambient で与える。それでも足りない
// 例（その例のためだけのプレースホルダを使うもの）は、目印で明示的に除外する。
//
// 目印（コードフェンスの直前の行に置く）:
//   <!-- doccheck: skip 理由 -->   … 検査しない。**理由は必須**（何を諦めたかが見える）
//   <!-- doccheck: expect-error --> … 型エラーになることを示す例（ならなかったら落とす）
//   <!-- doccheck: fields -->        … 宣言済みカスタム項目を前提にした例（サンプルのカタログを与える）
//
// 限界（承知のうえ）:
//   - `expect-error` は**ブロック単位**なので、意図した型エラーがあるブロックでは
//     **意図しない別のエラーが隠れる**。行単位にすると目印が本文に散らかるので採らない。
//   - 総称型に型引数を渡す例は、その型を例の中で import する必要がある（ambient の
//     エイリアスは型引数を落とすため）。利用者が書く形と同じなので実害は無い。
//   - 検査するのは**型が通ること**だけで、実行はしない。値の正しさは保証しない。
//
// 使い方: `pnpm check:docs`。落ちたら、例を直すか目印を付ける。

import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { globSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

// 検査対象。ADR / レビュー台帳 / 生成物は対象外 — 決定の記録や生成物のコードは
// 「動くこと」を約束していない（README とガイドは約束している）。
const MARKDOWN_ROOTS = [
  "README.md",
  "docs/usage/index.md",
  "docs/usage/start/**/*.md",
  "docs/usage/concepts/**/*.md",
  "docs/usage/howto/**/*.md",
];

// JSDoc の `@example` も対象。これは **`docs/usage/api` に生成されて利用者に見える**ので、
// ガイドのコード例とまったく同じ性質を持つ（ADR-0068 の生成物経由で公開される）。
// 実測（2026-09-11）では 7 個あり、いずれも通っていた＝ここは予防のための追加。
const SOURCE_ROOTS = ["src/**/*.ts"];
const REPO = process.cwd();

/** `src/**` の `export class` を採る。クラスは**値であり型でもある**ので両方の宣言が要る。 */
const exportedClasses = () => {
  const names = new Set();
  for (const f of globSync("src/**/*.ts", { cwd: REPO })) {
    if (f.endsWith(".test.ts")) continue;
    for (const m of readFileSync(f, "utf8").matchAll(/export class (\w+)/g))
      names.add(m[1]);
  }
  return names;
};

/** `src/index.ts` の export 節から公開記号を採る（値と型を分ける）。 */
const publicSymbols = () => {
  const src = readFileSync("src/index.ts", "utf8");
  const values = new Set();
  const types = new Set();
  const add = (into, body) => {
    for (const raw of body.split(",")) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) into.add(name);
    }
  };
  for (const m of src.matchAll(/export\s+type\s*\{([^}]*)\}/g))
    add(types, m[1]);
  for (const m of src.matchAll(/export\s+(?!type)\{([^}]*)\}/g))
    add(values, m[1]);
  return { values: [...values], types: [...types] };
};

/**
 * 断片が前提にしている名前。本文のコード例は説明の都合でこれらを宣言せずに使う。
 *
 * 2 種類ある。**このライブラリの値**（`porters` / `t`）と、**読者側のコードを指すプレースホルダ**
 * （`kv` / `jobId` / `fetchMyAccessToken` など）。後者に型を与えておくと、例が「読者のコードが
 * こういう形なら通る」ところまで検査される。ここに無い名前を使う例は `skip` が要る。
 */
const CONVENTIONAL = `
// このライブラリの値
const porters: PortersClient;
const t: TenantScope;
const host: string;
const appId: string;
const appSecret: string;
const partition: number;
const id: number;
const code: string;
const redirectUrl: string;
const scopes: Scope[];
const myFields: DefinedFields;
// 捕まえたエラー（エラーの項目を並べて説明する例で使う）
const e: PortersError;

// 読者側のコードを指すプレースホルダ
const logger: {
  warn: (...a: unknown[]) => void;
  info: (...a: unknown[]) => void;
  error: (...a: unknown[]) => void;
};
const jobId: number;
const fileBytes: Uint8Array;
const base64: string;
const codeFromRedirect: string;
const fetchMyAccessToken: () => Promise<string>;
const kv: {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del: (key: string) => Promise<void>;
};
const req: { user: string };
const tokenStore: TokenStore;
const lookupPartitionForUser: (user: string) => Promise<number>;
const query: CandidateSearchQuery;
const inputs: CandidateCreateInput[];
const file: AttachmentCreate;
`;

/**
 * `doccheck: fields` の例が前提にする、宣言済みカスタム項目つきのテナントスコープ。
 *
 * カスタム項目の例は「`defineFields` で宣言したあと」の話をするので、既定の `t`
 * （カスタム項目なし）では通らない。ここで**サンプルのカタログ**を与えて、
 * 宣言済みの型として実際に検査する（`U_score` が Number であることまで効く）。
 */
const SAMPLE_CATALOG = `{
  candidate: { U_score: "Number"; U_source: "Option"; U_hiredOn: "Date" };
  resume: { U_photo: "Image"; U_contact: "Link" };
  job: { U_headcount: "Number" };
}`;

// `t` と `porters` の両方を差し替えられるようにする。例は `t.candidate…` とも
// `porters.tenant(1).resume…` とも書くため。
//
// 型は**明示 import する**。ambient のエイリアス（`type TenantScope = __Lib.TenantScope`）は
// **型引数を落とす**ので `TenantScope<…>` と書けない。同じ理由で、コード例が総称型に
// 型引数を渡す場合はその型を例の中で import する必要がある（利用者が書く形と同じ）。

/** ブロックが自分で宣言していない名前だけを前置きする（再宣言を避ける）。 */
const withFieldsFor = (code) => {
  const lines = [
    `import type {`,
    `  PortersClient as __PC,`,
    `  TenantScope as __TS,`,
    `} from "@joymerrevent/porters-connect";`,
  ];
  if (!/\b(const|let|var)\s+t\b/.test(code))
    lines.push(`declare const t: __TS<${SAMPLE_CATALOG}>;`);
  if (!/\b(const|let|var)\s+porters\b/.test(code))
    lines.push(`declare const porters: __PC<${SAMPLE_CATALOG}>;`);
  return `${lines.join("\n")}\n`;
};

const KINDS = new Set(["skip", "expect-error", "fields"]);

/**
 * 目印を読む。フェンス直前の行だけを見る。**複数指定できる**
 * （例: `<!-- doccheck: fields expect-error -->` — 宣言済み項目を前提にしつつ、
 * 意図的な型エラーを含む例）。`skip` の残りは理由として扱う。
 */
const directiveOf = (line) => {
  const text = line.trim();
  // Markdown は HTML コメント、JSDoc の `@example` は行コメント。
  const m =
    /^<!--\s*doccheck:\s*(.*?)\s*-->$/.exec(text) ??
    /^\/\/\s*doccheck:\s*(.*?)\s*$/.exec(text);
  if (!m) return undefined;
  const words = m[1].split(/\s+/).filter((w) => w !== "");
  const kinds = new Set();
  let i = 0;
  while (i < words.length && KINDS.has(words[i])) kinds.add(words[i++]);
  if (kinds.size === 0) return undefined;
  return { kinds, reason: words.slice(i).join(" ") };
};

/**
 * フェンスの上にある目印を探す。**空行は飛ばす** — prettier が目印とフェンスの間に
 * 空行を入れるため、直前の 1 行だけを見る実装は整形しただけで壊れる（実際に踏んだ）。
 */
const directiveAbove = (lines, fenceIndex) => {
  for (let i = fenceIndex - 1; i >= 0; i--) {
    if (lines[i].trim() === "") continue;
    return directiveOf(lines[i]);
  }
  return undefined;
};

/** Markdown から ```ts ブロックを抜く。行番号は 1 始まりで元ファイルのもの。 */
const blocksOf = (file) => {
  const lines = readFileSync(file, "utf8").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "```ts") continue;
    const start = i;
    let end = i + 1;
    while (end < lines.length && lines[end].trim() !== "```") end++;
    out.push({
      file,
      // フェンスの次の行が本文の 1 行目
      firstLine: start + 2,
      code: lines.slice(start + 1, end).join("\n"),
      directive: directiveAbove(lines, start),
    });
    i = end;
  }
  return out;
};

const files = MARKDOWN_ROOTS.flatMap((p) =>
  p.includes("*") ? globSync(p, { cwd: REPO }) : [p],
).sort();
/**
 * JSDoc の `@example` を抜く。`*` の飾りを外し、次の `@tag` かコメント終端で切る。
 * 目印は例の 1 行目に `// doccheck: …` と書く（Markdown の HTML コメントは使えない）。
 */
const examplesOf = (file) => {
  const lines = readFileSync(file, "utf8").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\*\s*@example\s*$/.test(lines[i])) continue;
    const body = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const ln = lines[j];
      if (/^\s*\*\/\s*$/.test(ln)) break; // コメント終端
      if (/^\s*\*\s*@\w+/.test(ln)) break; // 次のタグ
      body.push(ln.replace(/^\s*\* ?/, ""));
    }
    const first = body[0]?.trim() ?? "";
    const directive = directiveOf(first);
    out.push({
      file,
      // 目印の行は本文から外す
      firstLine: i + 2 + (directive ? 1 : 0),
      code: (directive ? body.slice(1) : body).join("\n").trimEnd(),
      directive,
    });
    i = j;
  }
  return out.filter((b) => b.code.trim() !== "");
};

const sourceFiles = SOURCE_ROOTS.flatMap((p) => globSync(p, { cwd: REPO }))
  .filter((f) => !f.endsWith(".test.ts"))
  .sort();

const blocks = [
  ...files.flatMap((f) => blocksOf(f)),
  ...sourceFiles.flatMap((f) => examplesOf(f)),
];

const skipped = blocks.filter((b) => b.directive?.kinds.has("skip"));
const missingReason = skipped.filter((b) => b.directive.reason === "");
const checked = blocks.filter((b) => !b.directive?.kinds.has("skip"));

if (missingReason.length > 0) {
  console.error(
    "`doccheck: skip` には理由が要ります（何を諦めたかが見える形にする）:",
  );
  for (const b of missingReason) console.error(`  ${b.file}:${b.firstLine}`);
  process.exit(1);
}

// 対象が 1 件も見つからないのは「例が無い」ではなく**検査対象の指定が外れている**合図。
// ディレクトリを動かしたときに静かに検査が消えるのを防ぐ（ADR-0070 の移設で実際に起きうる）。
const MIN_BLOCKS = 40;
if (blocks.length < MIN_BLOCKS) {
  console.error(
    `検査対象が ${String(blocks.length)} ブロックしかありません（最低 ${String(MIN_BLOCKS)} 件を期待）。\n` +
      `MARKDOWN_ROOTS / SOURCE_ROOTS がドキュメントの現在地と合っているか確認してください。`,
  );
  process.exit(1);
}

const scratch = mkdtempSync(join(tmpdir(), "porters-doc-examples-"));
try {
  const caseDir = join(scratch, "cases");
  mkdirSync(caseDir, { recursive: true });

  const { values, types } = publicSymbols();
  const classes = exportedClasses();
  // caseDir からの相対で書く。絶対パスは環境によって解決されず、失敗しても
  // `__Lib` が `any` になるだけで**静かに全部通る**（下のカナリアで検出する）。
  const entry = relative(caseDir, resolve(REPO, "src/index"))
    .split(sep)
    .join("/");

  writeFileSync(
    join(caseDir, "globals.d.ts"),
    [
      `import type * as __Lib from ${JSON.stringify(entry)};`,
      "export {};",
      "declare global {",
      ...values.map((n) =>
        classes.has(n)
          ? `  const ${n}: typeof __Lib.${n};\n  type ${n} = __Lib.${n};`
          : `  const ${n}: typeof __Lib.${n};`,
      ),
      ...types.map((n) => `  type ${n} = __Lib.${n};`),
      CONVENTIONAL.split("\n")
        .map((l) => (l.trim() === "" ? l : `  ${l.replace(/^declare /, "")}`))
        .join("\n"),
      "}",
    ].join("\n"),
  );

  // カナリア。ハーネスが壊れている（入口が解決できず全部 `any` になる等）と、検査は
  // **静かに全部通る**——ゲートとしては最悪の壊れ方なので、毎回 2 つの番人で確かめる。
  // 1 つは必ず落ちるべき例、もう 1 つは必ず通るべき例。
  const CANARIES = [
    {
      name: "canary-must-fail.ts",
      code: 'const bad: number = "not a number";\nexport {};\n',
      mustFail: true,
    },
    {
      name: "canary-must-pass.ts",
      code: "const ok: PortersClient = porters;\nexport {};\n",
      mustFail: false,
    },
  ];
  for (const c of CANARIES) writeFileSync(join(caseDir, c.name), c.code);

  // 1 ブロック = 1 モジュール。`export {}` を足して module 扱いにする（ambient を使うため）。
  const names = checked.map((b, i) => {
    const name = `case-${String(i).padStart(3, "0")}.ts`;
    // `fields` の例だけ、宣言済みカスタム項目つきの `t` / `porters` に差し替える。
    // ブロックが自分で同名を宣言している場合は入れない（再宣言になる）。
    const pre = b.directive?.kinds.has("fields") ? withFieldsFor(b.code) : "";
    // 前置きの行数だけ、報告の行番号を戻す必要がある。
    b.offset = pre === "" ? 0 : pre.split("\n").length - 1;
    writeFileSync(join(caseDir, name), `${pre}${b.code}\nexport {};\n`);
    return name;
  });

  writeFileSync(
    join(caseDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          module: "esnext",
          moduleResolution: "bundler",
          target: "es2022",
          lib: ["es2023", "dom"],
          noEmit: true,
          skipLibCheck: true,
          types: ["node"],
          // 一時ディレクトリはリポジトリの外なので、@types をここから辿れない。
          // 指定しないと TS2688 で**検査が始まる前に**落ち、per-file エラーが 0 件になる
          // ＝「全部通った」に見える（カナリアが実際にこれを捕まえた）。
          typeRoots: [resolve(REPO, "node_modules/@types")],
          // 例は利用者が書く形（パッケージ名）で import する。それをそのまま検査したいので
          // ソースへ向ける。
          // baseUrl は TS 6 で非推奨。paths は tsconfig からの相対で解決される。
          paths: {
            "@joymerrevent/porters-connect": [
              relative(caseDir, resolve(REPO, "src/index.ts"))
                .split(sep)
                .join("/"),
            ],
          },
          // 例は「使わない変数」を持ちがち（説明のための宣言）。そこは咎めない。
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
        include: ["*.ts"],
      },
      null,
      2,
    ),
  );

  let raw = "";
  try {
    execFileSync("tsc", ["-p", caseDir], {
      cwd: REPO,
      stdio: ["ignore", "pipe", "pipe"],
      preferLocal: true,
    });
  } catch (e) {
    raw = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }

  // ケース名 -> エラー行
  const errors = new Map();
  for (const line of raw.split("\n")) {
    const m = /^(?:.*[/\\])?(case-\d+)\.ts\((\d+),(\d+)\): (.*)$/.exec(line);
    if (!m) continue;
    const idx = names.indexOf(`${m[1]}.ts`);
    if (idx < 0) continue;
    (errors.get(idx) ?? errors.set(idx, []).get(idx)).push({
      line: Number(m[2]),
      column: Number(m[3]),
      message: m[4],
    });
  }

  // まずハーネス自身を検査する。ここが崩れていたら、ケースの結果は信用できない。
  const canaryFailed = new Set();
  for (const line of raw.split("\n")) {
    const m = /^(?:.*[/\\])?(canary-[\w-]+)\.ts\(/.exec(line);
    if (m) canaryFailed.add(`${m[1]}.ts`);
  }
  for (const c of CANARIES) {
    const failed = canaryFailed.has(c.name);
    if (failed === c.mustFail) continue;
    console.error(
      c.mustFail
        ? "検査が壊れています: **必ず型エラーになるはずの例が通りました**。" +
            "このままでは全ブロックが素通りします。tsc の出力:"
        : "検査が壊れています: **必ず通るはずの例が落ちました**。ambient の宣言を見直してください。tsc の出力:",
    );
    console.error(raw.split("\n").slice(0, 12).join("\n"));
    process.exitCode = 1;
    rmSync(scratch, { recursive: true, force: true });
    process.exit(1);
  }

  const problems = [];
  checked.forEach((b, i) => {
    const errs = errors.get(i) ?? [];
    const expectError = b.directive?.kinds.has("expect-error") ?? false;
    if (expectError && errs.length === 0) {
      problems.push({
        block: b,
        why: "`doccheck: expect-error` と書かれているのに型エラーになりません（例が古いか、目印が余計）",
        errs: [],
      });
      return;
    }
    if (!expectError && errs.length > 0) {
      const inPreamble = errs.filter((e) => e.line <= (b.offset ?? 0));
      if (inPreamble.length > 0) {
        problems.push({
          block: b,
          why: "検査の前置き（`doccheck: fields`）でエラー。ハーネス側の問題",
          errs: inPreamble.map((e) => ({ ...e, line: 1 })),
        });
        return;
      }
      problems.push({ block: b, why: "型エラー", errs });
    }
  });

  const summary = `検査 ${String(checked.length)} ／ 除外 ${String(skipped.length)} ／ 全 ${String(blocks.length)} ブロック`;
  if (problems.length === 0) {
    console.log(`ドキュメントのコード例はコンパイルします（${summary}）。`);
    process.exit(0);
  }

  console.error(
    `ドキュメントのコード例が今の公開 API と合っていません（${summary}）。\n`,
  );
  for (const p of problems) {
    console.error(
      `${relative(REPO, p.block.file)}:${String(p.block.firstLine)} — ${p.why}`,
    );
    for (const e of p.errs) {
      // 生成ファイルの行 -> 元の Markdown の行
      console.error(
        `  ${relative(REPO, p.block.file)}:${String(p.block.firstLine + e.line - 1 - (p.block.offset ?? 0))}:${String(e.column)}  ${e.message}`,
      );
    }
    console.error("");
  }
  console.error(
    "例を直すか、`<!-- doccheck: skip 理由 -->` で明示的に除外してください。",
  );
  process.exit(1);
} finally {
  if (process.env.DOCCHECK_KEEP !== "1")
    rmSync(scratch, { recursive: true, force: true });
  else console.error("scratch:", scratch);
}
