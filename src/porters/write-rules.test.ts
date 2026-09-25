import { describe, expect, it } from "vitest";

import { MAX_WRITE_ITEMS } from "./write-rules";

// 値は出典（docs/usage/reference）のとおりに固定する。出典が変わったらここが落ちる。
describe("porters/write-rules", () => {
  it("takes up to 200 records per Write", () => {
    expect(MAX_WRITE_ITEMS).toBe(200);
  });
});
