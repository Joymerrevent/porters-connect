// @ts-check
// 依存側（node_modules）にある記号の「Defined in」から pnpm ストアのパスを落とす。
//
// なぜ要るか: `PortersError` は `Error` を継承しているので、TypeDoc は `message` / `cause` /
// `captureStackTrace` などの定義元も出力する。そのパスには pnpm ストアの**版つきディレクトリ**が
// 埋まる（`node_modules/.pnpm/@types+node@26.4.0/node_modules/@types/node/globals.d.ts:67`）。
// すると `@types/node` や `typescript` が上がるたび、中身が同じまま 5 ファイル 35 行が変わり、
// `check:api` が依存更新とは無関係な理由で落ちる（#281 で実際に落ちた）。
//
// ADR-0068 決定1 で gitRevision をコミット SHA からブランチ名に固定したのと同じ理由＝
// **生成物の差分を、意味のある変更だけにする**。継承メンバー自体は読者に必要なので消さない
// （`excludeExternals` だと `message` / `name` / `stack` / `cause` まで落ちる）。
//
// 版を落としても行番号は残るので、上流の .d.ts が実際に動いたときは差分に出る＝検知は失われない。
//
// TypeDoc は `plugin` に並べたモジュールの `load` を呼ぶ。typedoc.json 経由で読ませるので、
// `pnpm docs:api` と `check:api`（`typedoc --out <tmp>`）の両方に同じ正規化がかかる。

import { Converter } from "typedoc";

// node_modules/.pnpm/<name>@<version>[_peer]/node_modules/ を丸ごと落とし、
// パッケージから見た相対パスだけ残す（@types/node/globals.d.ts など）。
const PNPM_STORE = /(?:^|.*\/)node_modules\/\.pnpm\/[^/]+\/node_modules\//;

/** @param {import("typedoc").Application} app */
export const load = (app) => {
  app.converter.on(Converter.EVENT_RESOLVE_END, (context) => {
    for (const reflection of Object.values(context.project.reflections)) {
      for (const source of reflection.sources ?? []) {
        source.fileName = source.fileName.replace(PNPM_STORE, "");
      }
    }
  });
};
