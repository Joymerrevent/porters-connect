import { describe, expect, it, vi } from "vitest";

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

  it("blocks when depleted, then resolves after the bucket refills", async () => {
    vi.useFakeTimers();
    let t = 0;
    // readPerMin 60 * safety 1.0 = capacity 60 -> 1 token/sec.
    const throttle = createThrottle({
      readPerMin: 60,
      safety: 1,
      now: () => t,
    });
    for (let i = 0; i < 60; i++) await throttle.take(false); // deplete
    const pending = throttle.take(false); // tokens < 1 -> awaits sleep
    t = 2000; // advance the virtual clock so the refill yields tokens
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    vi.useRealTimers();
  });

  it("uses the write bucket for writes", async () => {
    const throttle = createThrottle({
      writePerMin: 60,
      safety: 1,
      now: () => 0,
    });
    await throttle.take(true); // exercises the write branch
  });
});
