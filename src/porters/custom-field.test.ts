import { describe, expect, it } from "vitest";

import { CUSTOM_ALIAS_PATTERN, CUSTOM_ALIAS_PREFIX } from "./custom-field";

// 出典の命名規則（U_ はユーザーが作った項目、A_ はアプリが作った項目）に固定する。
describe("porters/custom-field", () => {
  it("matches U_ and A_ aliases only", () => {
    expect(CUSTOM_ALIAS_PATTERN.test("U_score")).toBe(true);
    expect(CUSTOM_ALIAS_PATTERN.test("A_flag")).toBe(true);
    expect(CUSTOM_ALIAS_PATTERN.test("P_Name")).toBe(false);
    expect(CUSTOM_ALIAS_PATTERN.test("xU_score")).toBe(false);
  });

  // 名前が空、または field / condition の書き方を壊す文字を含む alias は、宣言に使えない（RV-112）。
  it.each([
    "U_",
    "A_",
    "U_a,Person.P_Memo",
    "U_a:b",
    "U_a=b",
    "U_a.b",
    "U_a(b)",
    "U_a b",
    "U_a\tb",
  ])("refuses %j as a declaration", (alias) => {
    expect(CUSTOM_ALIAS_PATTERN.test(alias)).toBe(false);
  });

  it.each(["U_0A1B", "A_flag_2", "U_名前", "U_a-b"])(
    "accepts %j, whose characters the reference does not restrict",
    (alias) => {
      expect(CUSTOM_ALIAS_PATTERN.test(alias)).toBe(true);
    },
  );

  it("marks custom aliases by their prefix alone", () => {
    expect(CUSTOM_ALIAS_PREFIX.test("U_a.b")).toBe(true);
    expect(CUSTOM_ALIAS_PREFIX.test("P_Name")).toBe(false);
  });
});
