#!/usr/bin/env node
// 下限より古い TypeScript が読む型定義を `dist/` に書く（[ADR-0090]）。
//
// なぜ要るか: 同梱の型定義は TypeScript 5.4 で入った型（`NoInfer`）を使う。古い版で読むと
// `skipLibCheck: true` の下ではエラーも出ずに**黙って誤った型**になる（宣言していない項目まで
// `create` の必須になる）。`package.json` の `exports` に `types@<X` の条件を置き、古い版だけを
// このファイルに向ける。ここでは公開名のそれぞれを「TypeScript X 以上が要る」という文字列の型にし、
// 利用者のコードで使った瞬間に、その文言がエラーに出るようにする。
//
// 下限の値 X は `package.json` の `exports` の `types@<X` 条件が正（ADR-0090 案2a）。ここでは読むだけ。
// 公開名は tsup が `dist/index.d.ts` の最後に書く `export { … }` の 1 行から採る（`type` 付きは型だけ）。
//
// 使い方: `pnpm build` の最後に走る（`emit-cts-types.mjs` の後）。単体でも `node scripts/emit-too-old-types.mjs`。
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** `types@<X` 条件のキーから X（`5.4` など）を採る。 */
export const FLOOR_CONDITION = /^types@<(\d+\.\d+)$/;

/**
 * `package.json` の `exports["."]` の `import` / `require` から下限を読む。
 * 両方にあり、同じ値でなければ例外（片方だけ直した状態で配らない）。
 */
export const floorOf = (pkg) => {
  const entry = pkg?.exports?.["."] ?? {};
  const found = ["import", "require"].map((cond) => {
    const keys = Object.keys(entry[cond] ?? {});
    const hit = keys.map((k) => FLOOR_CONDITION.exec(k)).find(Boolean);
    return {
      cond,
      floor: hit?.[1],
      target: hit ? entry[cond][hit[0]] : undefined,
    };
  });
  for (const f of found) {
    if (f.floor === undefined) {
      throw new Error(`exports["."].${f.cond} に types@<X の条件がありません`);
    }
  }
  if (found[0].floor !== found[1].floor) {
    throw new Error(
      `exports["."] の import と require で下限が違います（${found[0].floor} と ${found[1].floor}）`,
    );
  }
  return {
    floor: found[0].floor,
    importTarget: found[0].target,
    requireTarget: found[1].target,
  };
};

/**
 * `dist/index.d.ts` の最後の `export { … };` から公開名を採る。
 * `type X` は型だけ、それ以外は値（クラス・関数・定数）。`X as Y` は公開名 `Y` を採る。
 */
export const exportedNames = (dts) => {
  const blocks = [...dts.matchAll(/^export \{([^}]*)\};?\s*$/gm)];
  if (blocks.length === 0) throw new Error("export { … } の行が見つかりません");
  const names = [];
  for (const block of blocks) {
    for (const raw of block[1].split(",")) {
      const item = raw.trim();
      if (item === "") continue;
      const isType = item.startsWith("type ");
      const spec = isType ? item.slice(5).trim() : item;
      const name = spec.includes(" as ") ? spec.split(" as ")[1].trim() : spec;
      names.push({ name, isType });
    }
  }
  return names;
};

// 型引数を取る公開型があるので、どの使い方でも「型引数の数が違う」で先に落ちないよう、
// 省略可能な型引数を多めに受ける（公開型のどれよりも多く。余っても害は無い）。
const TYPE_PARAMS =
  "<_1 = unknown, _2 = unknown, _3 = unknown, _4 = unknown, _5 = unknown, _6 = unknown>";

/** 公開名ごとに「TypeScript X 以上が要る」型を置いた型定義の本文を作る。 */
export const renderStub = (floor, names) => {
  const message = `@joymerrevent/porters-connect requires TypeScript ${floor} or later`;
  const lines = [
    `// Read only by TypeScript older than ${floor}: the real declarations need ${floor} or later.`,
    `// Every public name resolves to the message below, so the first use of it shows why.`,
    `type RequiresNewerTypeScript = ${JSON.stringify(message)};`,
  ];
  for (const { name, isType } of names) {
    lines.push(`export type ${name}${TYPE_PARAMS} = RequiresNewerTypeScript;`);
    if (!isType)
      lines.push(`export declare const ${name}: RequiresNewerTypeScript;`);
  }
  lines.push("export {};", "");
  return lines.join("\n");
};

// CLI として実行されたときだけ走らせる（テストからは import して関数を呼ぶ）。
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const dtsPath = resolve(root, "dist/index.d.ts");
  if (!existsSync(dtsPath)) {
    console.error(
      `✖ ${dtsPath} がありません（先に tsup の --dts を走らせてください）。`,
    );
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const { floor, importTarget, requireTarget } = floorOf(pkg);
  const stub = renderStub(floor, exportedNames(readFileSync(dtsPath, "utf8")));
  for (const target of [importTarget, requireTarget]) {
    writeFileSync(resolve(root, target), stub);
  }
  console.log(
    `✓ ${importTarget} / ${requireTarget}（TypeScript ${floor} 未満の向け先・ADR-0090）`,
  );
}
