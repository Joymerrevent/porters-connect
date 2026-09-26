import { describe, expectTypeOf, it } from "vitest";

import type { Limit, Paging } from "./paging";

describe("accessor/paging — Limit / Paging（ADR-0099）", () => {
  it("Paging is Limit plus start", () => {
    expectTypeOf<Paging>().toEqualTypeOf<Limit & { start?: number }>();
    expectTypeOf<Limit>().toEqualTypeOf<{ count?: number }>();
  });
});
