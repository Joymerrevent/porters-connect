// Barrel: re-exports the errors module. Cross-module visibility is controlled
// by `export` per file; the npm public surface is curated in src/index.ts.

export * from "./porters-error";
export * from "./classify";
