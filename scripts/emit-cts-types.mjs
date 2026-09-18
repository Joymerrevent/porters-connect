#!/usr/bin/env node
// `dist/index.d.cts` を `dist/index.d.ts` のコピーとして置く（[ADR-0082]）。
//
// なぜ要るか: 配るのは **ESM 実体 1 つ**で、`require` 条件も同じ `dist/index.js` に向けている
// （Node の `require(esm)`・22.12+）。実体が 2 つあると ESM 側と CJS 側で**別のクラス**が読まれ、
// `instanceof PortersError` が `false` になる＝ [ADR-0006] のエラーモデルが `catch` を素通りする。
// 一方 TypeScript は **`require` 側の型を CJS として解決する**（`moduleResolution: node16` の
// CJS 利用者）ので、`.d.ts` を指すと `TS1479` になる。型だけ `.d.cts` の名前で置けばよい。
//
// 中身が同一でよいのは、公開 API に `export default` が無く**名前付き export だけ**だから。
// `require()` で得られるモジュール名前空間オブジェクトの形と一致する。
// default export を足すならここを見直すこと（CJS 側の `.default` の扱いが変わる）。
//
// 使い方: `pnpm build` の最後に走る。単体でも `node scripts/emit-cts-types.mjs`。
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../dist/index.d.ts", import.meta.url));
const dest = fileURLToPath(new URL("../dist/index.d.cts", import.meta.url));

// 黙って作らないと、`require` 条件の `types` が存在しないファイルを指したまま publish される。
if (!existsSync(src)) {
  console.error(
    `✖ ${src} がありません（先に tsup の --dts を走らせてください）。`,
  );
  process.exit(1);
}

copyFileSync(src, dest);
console.log("✓ dist/index.d.cts（dist/index.d.ts のコピー・ADR-0082）");
