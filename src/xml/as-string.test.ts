import { describe, expect, it } from "vitest";

import { asString } from "./as-string";

describe("asString", () => {
  it("string -> string; else undefined", () => {
    expect(asString("x")).toBe("x");
    expect(asString(5)).toBeUndefined();
  });
});
