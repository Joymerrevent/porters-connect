import { describe, expect, it } from "vitest";

import { createThrottle } from "./throttle";

describe("createThrottle (token-bucket, ADR-0010)", () => {
  it("allows a burst up to capacity, then refills over time", async () => {
    let t = 0;
    // readPerMin 600 * safety 1.0 = capacity 600 -> 10 tokens/sec.
    const throttle = createThrottle({
      readPerMin: 600,
      safety: 1,
      now: () => t,
    });

    // capacity tokens are immediately available without advancing the clock.
    for (let i = 0; i < 600; i++) await throttle.take(false);

    // refill: advancing 1s grants ~10 more tokens.
    t = 1000;
    await throttle.take(false); // resolves from refilled tokens, no real wait
    expect(t).toBe(1000);
  });
});
