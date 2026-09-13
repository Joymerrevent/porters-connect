import { describe, expect, it, vi } from "vitest";

import {
  createThrottle,
  createThrottleRegistry,
  resetSharedThrottles,
  sharedThrottleFor,
} from "./throttle";

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

// ADR-0073: バケットは client ごとではなく**ホストごと**。テナント別に client を立てても
// 合計が上限に収まることが要件なので、「同じホストなら同じ実体」を直接 pin する。
describe("createThrottleRegistry (per-host buckets, ADR-0073)", () => {
  const counting = () => {
    let made = 0;
    const registry = createThrottleRegistry(() => {
      made += 1;
      return { take: () => Promise.resolve() };
    });
    return { registry, made: () => made };
  };

  it("同じホストには同じバケットを返す", () => {
    const { registry, made } = counting();
    const a = registry.forHost("xxxxx.example.com");
    const b = registry.forHost("xxxxx.example.com");
    expect(b).toBe(a);
    expect(made()).toBe(1);
  });

  it("違うホストには別のバケットを返す", () => {
    const { registry, made } = counting();
    const a = registry.forHost("xxxxx.example.com");
    const b = registry.forHost("127.0.0.1:4010");
    expect(b).not.toBe(a);
    expect(made()).toBe(2);
  });

  it("ホスト名の大小は無視する（ホストは case-insensitive）", () => {
    const { registry, made } = counting();
    const a = registry.forHost("XXXXX.Example.COM");
    const b = registry.forHost("xxxxx.example.com");
    expect(b).toBe(a);
    expect(made()).toBe(1);
  });

  it("ポートが違えば別のバケット（別の宛先だから）", () => {
    const { registry } = counting();
    expect(registry.forHost("localhost:4010")).not.toBe(
      registry.forHost("localhost:4011"),
    );
  });

  it("reset() で忘れる（テスト用の継ぎ目）", () => {
    const { registry, made } = counting();
    const before = registry.forHost("xxxxx.example.com");
    registry.reset();
    expect(registry.forHost("xxxxx.example.com")).not.toBe(before);
    expect(made()).toBe(2);
  });
});

describe("sharedThrottleFor (process-wide registry)", () => {
  it("プロセス全体で 1 ホスト 1 バケット", () => {
    resetSharedThrottles();
    expect(sharedThrottleFor("xxxxx.example.com")).toBe(
      sharedThrottleFor("xxxxx.example.com"),
    );
    expect(sharedThrottleFor("other.example.com")).not.toBe(
      sharedThrottleFor("xxxxx.example.com"),
    );
  });

  it("既定のバケットは本物のスロットル（take できる）", async () => {
    resetSharedThrottles();
    await expect(
      sharedThrottleFor("xxxxx.example.com").take(false),
    ).resolves.toBeUndefined();
  });
});
