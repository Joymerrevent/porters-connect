#!/usr/bin/env node
// 利用者の TypeScript の下限を**実際の版で**確かめる検査（[ADR-0090]）。
//
// なぜ要るか: 同梱の型定義が新しい TypeScript の機能を使うと、古い版の利用者は黙って誤った型を
// 受け取る（0.23.0 に向けて `NoInfer` を入れたとき、PR の時点では誰も気づかなかった）。
// 下限を README に書くだけでは約束にならない — **約束した版を走らせて初めて約束になる**（RV-53）。
//
// 何を確かめるか（ビルドした型定義に対して、利用者と同じ解決の経路で）:
//   (1) 下限の版（`types@<X` の X の系で、公開されている最も古い安定版）でコンパイルが通る
//   (2) 開発で使う版（リポジトリの TypeScript）でも通る
//   (3) 下限より古い版（X より前で最も新しい安定版）では、「TypeScript X 以上が要る」の文言で落ちる
//       ＝ `exports` / `typesVersions` の向け先が効いている（ADR-0090 案1a）
// それぞれを 4 つの解決方式（bundler / node16 の ESM / node16 の CJS / node）で行う。
//
// 利用者のコードには `@ts-expect-error` を含める。型が `any` に崩れて何でも通る状態になると、
// エラーになるはずの行がならず、`@ts-expect-error` が「使われていない」で落ちる＝素通りしない。
//
// 使い方: `pnpm build` の後に `pnpm check:ts-floor`。dist と npm レジストリを見るので、
// `pnpm check`（束ね）には入れていない（`check:cjs` と同じ扱い）。
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { floorOf } from "./emit-too-old-types.mjs";

const STABLE = /^(\d+)\.(\d+)\.(\d+)$/;

const cmp = (a, b) => {
  const pa = STABLE.exec(a).slice(1).map(Number);
  const pb = STABLE.exec(b).slice(1).map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

/**
 * 公開されている版の一覧から、下限の系で最も古い安定版と、下限より前で最も新しい安定版を選ぶ。
 * プレリリース（`-rc` など）は除く。見つからなければ例外（素通りさせない）。
 */
export const pickVersions = (published, floor) => {
  const [major, minor] = floor.split(".").map(Number);
  const stable = published.filter((v) => STABLE.test(v)).sort(cmp);
  const inFloor = stable.filter((v) => {
    const [ma, mi] = v.split(".").map(Number);
    return ma === major && mi === minor;
  });
  const below = stable.filter((v) => cmp(v, `${major}.${minor}.0`) < 0);
  if (inFloor.length === 0)
    throw new Error(`TypeScript ${floor} の安定版が見つかりません`);
  if (below.length === 0)
    throw new Error(`TypeScript ${floor} より前の安定版が見つかりません`);
  return { floor: inFloor[0], below: below[below.length - 1] };
};

/** 解決方式ごとの利用者のプロジェクト（package.json の type と tsconfig の compilerOptions）。 */
export const MODES = [
  {
    name: "bundler",
    type: "module",
    options: { module: "esnext", moduleResolution: "bundler" },
  },
  {
    name: "node16-esm",
    type: "module",
    options: { module: "node16", moduleResolution: "node16" },
  },
  {
    name: "node16-cjs",
    type: "commonjs",
    options: { module: "node16", moduleResolution: "node16" },
  },
  {
    name: "node",
    type: "commonjs",
    options: { module: "commonjs", moduleResolution: "node" },
  },
];

// 利用者のコード。公開 API の代表的な使い方と、型エラーになるべきところを並べる。
export const CONSUMER = `import {
  PortersClient,
  defineFields,
  type TenantScope,
} from "@joymerrevent/porters-connect";

const porters = new PortersClient({ hostname: "h.example", appId: "a", appSecret: "s" });
const fields = defineFields({
  candidate: (f) => ({ U_must: f.number({ required: true }), U_may: f.option() }),
});
const t = porters.tenant(1, { fields });

export const read = async () => {
  const page = await t.candidate.search({ field: ["P_Id", "U_must"] });
  const score: number | null | undefined = page.items[0]?.U_must;
  return score;
};
export const create = () => t.candidate.create({ P_Owner: 1, U_must: 1 }); // U_may は任意
export const update = () => t.candidate.update(1, { U_may: ["Opt_A"] });
export const typed = (s: TenantScope<typeof fields>) => s.candidate.create({ P_Owner: 1, U_must: 2 });

// @ts-expect-error -- U_must was declared required
export const missing = () => t.candidate.create({ P_Owner: 1 });
// @ts-expect-error -- an undeclared custom field is not accepted
export const undeclared = () => t.candidate.update(1, { U_other: 1 });
// @ts-expect-error -- the value must match the declared Data Type
export const wrongType = () => t.candidate.update(1, { U_must: "1" });
`;

/** tsc の出力を、期待（通る / 文言で落ちる）と突き合わせる。問題があれば説明を返す。 */
export const judge = ({ expect, floor, status, output }) => {
  if (expect === "pass") {
    return status === 0 ? undefined : `コンパイルが通りません:\n${output}`;
  }
  const message = `requires TypeScript ${floor} or later`;
  if (status === 0)
    return "下限より古い版でコンパイルが通りました（向け先が効いていません）";
  return output.includes(message)
    ? undefined
    : `下限より古い版で落ちましたが、「${message}」の文言がありません:\n${output}`;
};

// CLI として実行されたときだけ走らせる（テストからは import して関数を呼ぶ）。
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const repo = fileURLToPath(new URL("..", import.meta.url));
  const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
  const { floor, importTarget } = floorOf(pkg);
  // dist が無いまま「通った」と言わないための入口ガード（fail-open 防止）。
  for (const f of ["dist/index.d.ts", "dist/index.d.cts", importTarget]) {
    if (!existsSync(join(repo, f))) {
      console.error(
        `✖ ${f} がありません。先に \`pnpm build\` を走らせてください。`,
      );
      process.exit(1);
    }
  }
  const published = JSON.parse(
    execFileSync("pnpm", ["view", "typescript", "versions", "--json"], {
      encoding: "utf8",
      // npm の設定に関する警告が stderr に出るだけなので、画面に流さない（失敗は例外で分かる）。
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  const picked = pickVersions(published, floor);
  const devVersion = JSON.parse(
    readFileSync(join(repo, "node_modules/typescript/package.json"), "utf8"),
  ).version;
  const runs = [
    { label: `下限 ${picked.floor}`, version: picked.floor, expect: "pass" },
    {
      label: `開発 ${devVersion}`,
      version: undefined,
      major: Number(devVersion.split(".")[0]),
      expect: "pass",
    },
    {
      label: `下限より前 ${picked.below}`,
      version: picked.below,
      expect: "fail",
    },
  ];

  const scratch = mkdtempSync(join(tmpdir(), "porters-ts-floor-"));
  const problems = [];
  try {
    for (const mode of MODES) {
      const dir = join(scratch, mode.name);
      mkdirSync(join(dir, "node_modules/@joymerrevent"), { recursive: true });
      symlinkSync(
        repo,
        join(dir, "node_modules/@joymerrevent/porters-connect"),
      );
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ type: mode.type }),
      );
      writeFileSync(
        join(dir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            types: [],
            ...mode.options,
          },
          files: ["app.ts"],
        }),
      );
      writeFileSync(join(dir, "app.ts"), CONSUMER);
      for (const run of runs) {
        // TypeScript 6 は `moduleResolution: node` を非推奨にし、既定でエラーにする。検査したいのは
        // 型定義が読めるかなので、6 以上ではその非推奨だけを止める（5.x はこの値を受け付けない）。
        const quiet =
          (run.major ?? 0) >= 6 ? ["--ignoreDeprecations", "6.0"] : [];
        const [cmd, args] =
          run.version === undefined
            ? [join(repo, "node_modules/.bin/tsc"), ["-p", dir, ...quiet]]
            : [
                "pnpm",
                [
                  `--package=typescript@${run.version}`,
                  "dlx",
                  "tsc",
                  "-p",
                  dir,
                ],
              ];
        let status = 0;
        let output = "";
        try {
          execFileSync(cmd, args, {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
          });
        } catch (error) {
          // tsc を起動できないのと、tsc が型エラーを報告したのは別物。混ぜると素通りしうる。
          if (typeof error.status !== "number") {
            problems.push(
              `${mode.name} / ${run.label}: tsc を起動できません（${error.message}）`,
            );
            continue;
          }
          status = error.status;
          output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
        }
        const why = judge({ expect: run.expect, floor, status, output });
        if (why) problems.push(`${mode.name} / ${run.label}: ${why}`);
        else console.log(`  ✓ ${mode.name} / ${run.label}`);
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  if (problems.length > 0) {
    console.error(
      `✖ TypeScript の下限（${floor}）の約束が守れていません（ADR-0090）:`,
    );
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(
    `✓ TypeScript の下限 ${floor} OK（${picked.floor} と開発の版で通り、${picked.below} は文言つきで止まる）`,
  );
}
