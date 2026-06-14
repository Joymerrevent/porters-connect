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
});
