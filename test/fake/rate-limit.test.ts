import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rate-limit";

const clock = () => {
  let t = 1_700_000_000_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe("rate limiter", () => {
  it("counts Read and Write against separate per-minute caps", () => {
    const c = clock();
    const rate = createRateLimiter(
      { readPerMinute: 2, writePerMinute: 1 },
      c.now,
    );

    expect(rate.take("read")).toBe(true);
    expect(rate.take("read")).toBe(true);
    expect(rate.take("read")).toBe(false);
    // The write bucket is untouched by the reads.
    expect(rate.take("write")).toBe(true);
    expect(rate.take("write")).toBe(false);
  });

  it("forgets requests older than the minute window", () => {
    const c = clock();
    const rate = createRateLimiter({ readPerMinute: 1 }, c.now);
    expect(rate.take("read")).toBe(true);
    expect(rate.take("read")).toBe(false);

    c.advance(60_001);

    expect(rate.take("read")).toBe(true);
  });

  it("enforces the monthly quota across both buckets", () => {
    const c = clock();
    const rate = createRateLimiter({ perMonth: 3 }, c.now);

    expect(rate.take("read")).toBe(true);
    expect(rate.take("write")).toBe(true);
    c.advance(120_000); // well past the per-minute windows
    expect(rate.take("read")).toBe(true);
    expect(rate.take("read")).toBe(false); // 4th request in the month

    c.advance(30 * 24 * 60 * 60_000 + 1);
    expect(rate.take("read")).toBe(true);
  });

  it("defaults to the reference limits and the disconnect reading", () => {
    const c = clock();
    const rate = createRateLimiter(undefined, c.now);

    expect(rate.mode).toBe("disconnect");
    for (let i = 0; i < 500; i += 1) expect(rate.take("write")).toBe(true);
    expect(rate.take("write")).toBe(false); // Write 500 / minute
    expect(rate.take("read")).toBe(true); // Read has its own 2000
  });

  it("can be switched off, and reset()", () => {
    const c = clock();
    const off = createRateLimiter(false, c.now);
    for (let i = 0; i < 10_000; i += 1) expect(off.take("write")).toBe(true);

    const rate = createRateLimiter({ readPerMinute: 1 }, c.now);
    rate.take("read");
    expect(rate.take("read")).toBe(false);
    rate.reset();
    expect(rate.take("read")).toBe(true);
  });
});
