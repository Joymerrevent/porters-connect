import { describe, expect, it } from "vitest";

import { asArray, asRecord, asString } from "./raw";

describe("raw narrowing helpers", () => {
  it("asRecord: object -> record; array / null / primitive -> undefined", () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord([1])).toBeUndefined();
    expect(asRecord(null)).toBeUndefined();
    expect(asRecord("x")).toBeUndefined();
  });

  it("asString: string -> string; else undefined", () => {
    expect(asString("x")).toBe("x");
    expect(asString(5)).toBeUndefined();
  });

  it("asArray: array as-is; single wrapped; null / undefined -> []", () => {
    expect(asArray([1, 2])).toEqual([1, 2]);
    expect(asArray("x")).toEqual(["x"]);
    expect(asArray(undefined)).toEqual([]);
    expect(asArray(null)).toEqual([]);
  });
});
