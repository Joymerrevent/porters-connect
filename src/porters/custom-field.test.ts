import { describe, expect, it } from "vitest";

import { CUSTOM_ALIAS_PATTERN } from "./custom-field";

// 出典の命名規則（U_ はユーザーが作った項目、A_ はアプリが作った項目）に固定する。
describe("porters/custom-field", () => {
  it("matches U_ and A_ aliases only", () => {
    expect(CUSTOM_ALIAS_PATTERN.test("U_score")).toBe(true);
    expect(CUSTOM_ALIAS_PATTERN.test("A_flag")).toBe(true);
    expect(CUSTOM_ALIAS_PATTERN.test("P_Name")).toBe(false);
    expect(CUSTOM_ALIAS_PATTERN.test("xU_score")).toBe(false);
  });
});
