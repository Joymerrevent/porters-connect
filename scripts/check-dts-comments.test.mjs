import { describe, expect, it } from "vitest";

import { dtsFindings } from "./check-dts-comments.mjs";

// 受理側と棄却側の両方を試す（check-api-reference.test.mjs と同じ規律）。検出規則そのものは
// そちらで網羅しているので、ここでは「d.ts の内容にその規則が当たっているか」だけを見る。
describe("dtsFindings（公開する型定義の JSDoc 検査）", () => {
  it("規約どおりなら何も言わない", () => {
    const dts = [
      "/** Create many records in one call. Auto-batched to ≤200 records. */",
      "declare const x: number;",
      "",
    ].join("\n");
    expect(dtsFindings(dts)).toEqual({ kana: [], ids: [] });
  });

  it("未 export の型に戻った ADR 番号を拾う（typedoc には出ない形）", () => {
    const dts = [
      "type Resource<F> = {",
      "  /** Create many records in one call (ADR-0041 / F-4). */",
      "  createMany(): void;",
      "};",
    ].join("\n");
    const { ids } = dtsFindings(dts);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe(
      "dist/index.d.ts:2: /** Create many records in one call (ADR-0041 / F-4). */",
    );
  });

  it("日本語（かな）も拾い、識別子と別に返す", () => {
    const dts = "/** メタデータだけ */\ndeclare const y: 1;\n";
    expect(dtsFindings(dts)).toEqual({
      kana: ["dist/index.d.ts:1: /** メタデータだけ */"],
      ids: [],
    });
  });

  it("パスは差し替えられる（報告の行頭に出る）", () => {
    expect(dtsFindings("/** RV-1 */\n", "x.d.ts").ids[0]).toBe(
      "x.d.ts:1: /** RV-1 */",
    );
  });
});
