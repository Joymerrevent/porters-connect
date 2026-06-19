import { describe, expect, it } from "vitest";

import { expoBackoff } from "./retry";

describe("expoBackoff (ADR-0010)", () => {
  it("stays within [0, ceil) with an exponentially growing ceiling (full jitter)", () => {
    const b = expoBackoff(100, 5000);
    for (let attempt = 0; attempt < 8; attempt++) {
      const ceil = Math.min(5000, 100 * 2 ** attempt);
      for (let i = 0; i < 50; i++) {
        const v = b(attempt);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(ceil);
      }
    }
  });

  it("caps at maxMs", () => {
    const b = expoBackoff(1000, 2000);
    for (let i = 0; i < 100; i++) expect(b(20)).toBeLessThan(2000);
  });

  it("jitter is non-degenerate and the ceiling grows with the attempt", () => {
    const b = expoBackoff(100, 100_000); // maxMs high enough not to clamp early
    const sample = (attempt: number): number[] =>
      Array.from({ length: 200 }, () => b(attempt));
    const a0 = sample(0); // ceiling 100
    const a4 = sample(4); // ceiling 1600

    // not everything floors to 0 (catches `random / ceil`)
    expect(a4.some((v) => v > 0)).toBe(true);
    // attempt 4's ceiling exceeds attempt 0's (catches `baseMs / 2 ** attempt`)
    expect(Math.max(...a0)).toBeLessThan(100);
    expect(Math.max(...a4)).toBeGreaterThan(100);
  });
});
