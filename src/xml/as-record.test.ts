import { describe, expect, it } from "vitest";

import { asRecord } from "./as-record";

describe("asRecord", () => {
  it("object -> record; array / null / primitive -> undefined", () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord([1])).toBeUndefined();
    expect(asRecord(null)).toBeUndefined();
    expect(asRecord("x")).toBeUndefined();
  });
});
