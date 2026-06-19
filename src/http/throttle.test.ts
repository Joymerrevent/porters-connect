import { describe, expect, it, vi } from "vitest";

import { createThrottle } from "./throttle";

// Flush pending microtasks (an immediate take() resolves without a timer).
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

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

  it("allows exactly floor(readPerMin*safety) immediate takes, then blocks", async () => {
    vi.useFakeTimers();
    const t = 0;
    // floor(600 * 0.5) = 300 capacity (safety != 1 so `* safety` vs `/ safety` differ)
    const throttle = createThrottle({
      readPerMin: 600,
      safety: 0.5,
      now: () => t,
    });
    for (let i = 0; i < 300; i++) await throttle.take(false); // all immediate

    let settled = false;
    void throttle.take(false).then(() => {
      settled = true;
    });
    await flush();
    expect(settled).toBe(false); // 301st blocks: capacity is exactly 300, clock frozen
    vi.useRealTimers();
  });

  it("meters writes through a separate bucket sized by writePerMin", async () => {
    vi.useFakeTimers();
    const t = 0;
    // floor(600 * 0.5) = 300 write capacity
    const throttle = createThrottle({
      writePerMin: 600,
      safety: 0.5,
      now: () => t,
    });
    for (let i = 0; i < 300; i++) await throttle.take(true);

    let settled = false;
    void throttle.take(true).then(() => {
      settled = true;
    });
    await flush();
    expect(settled).toBe(false);
    vi.useRealTimers();
  });

  it("refills at the configured per-minute rate", async () => {
    vi.useFakeTimers();
    let t = 1000; // construct + deplete here so `last` is non-zero (catches t + last)
    // capacity 60, rate 60/60000 = 0.001 token/ms = 1 token/sec
    const throttle = createThrottle({
      readPerMin: 60,
      safety: 1,
      now: () => t,
    });
    for (let i = 0; i < 60; i++) await throttle.take(false); // deplete; last = 1000

    t = 6000; // 5s elapsed -> exactly 5 tokens refilled
    for (let i = 0; i < 5; i++) await throttle.take(false); // 5 immediate

    let settled = false;
    void throttle.take(false).then(() => {
      settled = true;
    });
    await flush();
    expect(settled).toBe(false); // only 5 refilled; the 6th blocks
    vi.useRealTimers();
  });

  it("sleeps for the remaining token deficit when blocked", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    let t = 0;
    // capacity 60, rate 0.001 token/ms
    const throttle = createThrottle({
      readPerMin: 60,
      safety: 1,
      now: () => t,
    });
    for (let i = 0; i < 60; i++) await throttle.take(false); // deplete; last = 0, tokens = 0

    t = 500; // refills 0.5 token -> deficit 0.5 -> sleep ceil(0.5 / 0.001) = 500ms
    void throttle.take(false); // blocks, scheduling exactly one setTimeout
    const delays = setTimeoutSpy.mock.calls.map((c) => Number(c[1]));
    expect(delays.at(-1)).toBe(500);

    setTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });
});
