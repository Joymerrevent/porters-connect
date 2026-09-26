import { describe, expect, it } from "vitest";

import { PortersResourceError } from "./porters-error";
import { resourceCategory, resourceError } from "./resource-error";

describe("resource error classification (ADR-0006)", () => {
  // 表を写すのではなく、コードごとの期待値を並べる（表の行が抜けたら、ここで落ちる）。
  it.each([
    [9, "transient"],
    [302, "transient"],
    [401, "auth"],
    [402, "auth"],
    [6, "permission"],
    [400, "permission"],
    [403, "permission"],
    [406, "permission"],
    [601, "permission"],
    [7, "notFound"],
    [404, "notFound"],
    [301, "conflict"],
    [303, "conflict"],
    [304, "conflict"],
    [1000, "server"],
    [8, "validation"],
    [124, "validation"],
    [126, "validation"],
    [127, "validation"],
    [133, "validation"],
    [146, "validation"],
    [500, "validation"],
    [100, "validation"], // the range's floor
    [116, "validation"], // the range's ceiling
    [99, "unknown"], // just below the range
    [117, "unknown"], // just above the range
    [50, "unknown"],
    [99999, "unknown"],
  ] as const)("maps resource code %i to %s", (code, category) => {
    expect(resourceCategory(code)).toBe(category);
  });

  it("retryable: only transient resource codes", () => {
    expect(resourceError(9, "x").retryable).toBe(true);
    expect(resourceError(403, "x").retryable).toBe(false);
  });

  it("produces the right instance and carries code/category/hint", () => {
    const r = resourceError(403, "no perm", { resource: "Candidate" });
    expect(r).toBeInstanceOf(PortersResourceError);
    expect(r.category).toBe("permission");
    expect(r.code).toBe(403);
    expect(r.hint).toBeTypeOf("string");
  });

  it("carries non-empty hints only for the codes that have one", () => {
    // hint *content* (an empty string is still a string, so assert substrings)
    expect(resourceError(403, "x").hint).toContain("permission");
    expect(resourceError(404, "x").hint).toContain("Partition");
    expect(resourceError(9, "x").hint).toBeUndefined(); // resourceHint default
  });
});
