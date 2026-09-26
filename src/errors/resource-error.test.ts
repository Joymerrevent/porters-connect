import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

// reference の表を読み、載っているコードのうち分類していないものを確かめる（RV-114）。
// 表に行が足されたのに実装の表を直し忘れると、ここで落ちる。「126 / 127」「104〜116」の形も読む。
// 5（ユーザー ID 無効）は ADR-0006 の表に無く、unknown（再試行しない）に倒している。分類するかは
// RV-114 / RV-123 の ADR で決める。決まったら、この一覧から外す。
it("leaves only the known codes unclassified in the reference table", () => {
  const table = readFileSync(
    fileURLToPath(
      new URL(
        "../../docs/usage/reference/resource-api/result-codes.md",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  const codes = [
    ...table.matchAll(/^\| *(\d+)(?: *(?:\/|〜) *(\d+))? *\|/gm),
  ].flatMap(([, from, to]) => {
    const a = Number(from);
    const b = to === undefined ? a : Number(to);
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  });
  expect(codes).toContain(127);
  expect(codes).toContain(110);
  const unclassified = codes.filter(
    (c) => c !== 0 && resourceCategory(c) === "unknown",
  );
  expect(unclassified).toEqual([5]);
});
