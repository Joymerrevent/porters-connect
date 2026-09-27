import { describe, expect, it } from "vitest";

import { asArray } from "./as-array";

describe("asArray", () => {
  it("array as-is; single wrapped; null / undefined -> []", () => {
    expect(asArray([1, 2])).toEqual([1, 2]);
    expect(asArray("x")).toEqual(["x"]);
    expect(asArray(undefined)).toEqual([]);
    expect(asArray(null)).toEqual([]);
  });
});
