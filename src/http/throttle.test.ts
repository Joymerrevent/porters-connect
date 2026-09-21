import { describe, expect, it, vi } from "vitest";

import { PortersConfigError } from "../errors/index";

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
    const a = registry.forAuthority("xxxxx.example.com");
    const b = registry.forAuthority("xxxxx.example.com");
    expect(b).toBe(a);
    expect(made()).toBe(1);
  });

  it("違うホストには別のバケットを返す", () => {
    const { registry, made } = counting();
    const a = registry.forAuthority("xxxxx.example.com");
    const b = registry.forAuthority("127.0.0.1:4010");
    expect(b).not.toBe(a);
    expect(made()).toBe(2);
  });

  it("ホスト名の大小は無視する（ホストは case-insensitive）", () => {
    const { registry, made } = counting();
    const a = registry.forAuthority("XXXXX.Example.COM");
    const b = registry.forAuthority("xxxxx.example.com");
    expect(b).toBe(a);
    expect(made()).toBe(1);
  });

  it("ポートが違えば別のバケット（別の宛先だから）", () => {
    const { registry } = counting();
    expect(registry.forAuthority("localhost:4010")).not.toBe(
      registry.forAuthority("localhost:4011"),
    );
  });

  it("reset() で忘れる（テスト用の継ぎ目）", () => {
    const { registry, made } = counting();
    const before = registry.forAuthority("xxxxx.example.com");
    registry.reset();
    expect(registry.forAuthority("xxxxx.example.com")).not.toBe(before);
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

  it("resetSharedThrottles は共有バケットを本当に捨てる（テストの隔離が依存する継ぎ目）", () => {
    const before = sharedThrottleFor("xxxxx.example.com");
    resetSharedThrottles();
    // 何もしない実装でも他のテストは緑のまま通る（前のバケットを使い回すだけ）ので、ここで pin する。
    expect(sharedThrottleFor("xxxxx.example.com")).not.toBe(before);
  });

  it("既定のバケットは本物のスロットル（take できる）", async () => {
    resetSharedThrottles();
    await expect(
      sharedThrottleFor("xxxxx.example.com").take(false),
    ).resolves.toBeUndefined();
  });
});

// RV-49。容量 0 のバケットは「1 ミリ秒ごとに起きて token を待つ」ループになり、**永久に返らない**。
// 上限を下げて優しく叩くのは createThrottle を公開した目的そのもの（ADR-0073）なので、
// そこで無言のハングに倒れるのは安全側ではない。構築時に落とす。
describe("createThrottle の設定検証（RV-49）", () => {
  it("readPerMin 1 は既定の safety で容量 0 になるので弾く", () => {
    // これが現実に踏む経路。1 も 0.9 も単体では妥当で、積の floor(0.9)=0 だけが問題。
    expect(() => createThrottle({ readPerMin: 1 })).toThrow(PortersConfigError);
  });

  it("弾くときは何が起きるかと、どう直すかを言う", () => {
    try {
      createThrottle({ readPerMin: 1 });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PortersConfigError);
      const err = e as PortersConfigError;
      expect(err.category).toBe("config");
      // どの設定が悪いのか。
      expect(err.message).toContain("readPerMin");
      // 「待ち続ける」と分かること。数値だけ出しても症状に結び付かない。
      expect(err.message).toContain("wait forever");
      // 積の実値を出す（1 × 0.9 = 0.9）。ここが割り算などになっていたら意味が変わる。
      expect(err.message).toContain("floor(0.9) = 0");
      // safety 0.9 なら 2 以上にすれば通る、と具体値で示す。
      expect(err.hint).toContain("at least 2");
      // 「まったく通さない」を表現したい人の行き先も示す（許可と沈黙を分ける）。
      expect(err.hint).toContain("never resolves");
    }
  });

  it.each([
    ["safety 0", { safety: 0 }],
    ["safety が負", { safety: -1 }],
    ["safety が 1 超", { safety: 1.5 }],
    ["safety が NaN", { safety: Number.NaN }],
  ])("%s を弾く", (_label, opts) => {
    expect(() => createThrottle(opts)).toThrow(/safety must be/);
  });

  it("safety のエラーも category と直し方を持つ", () => {
    try {
      createThrottle({ safety: 0 });
      expect.unreachable("should have thrown");
    } catch (e) {
      const err = e as PortersConfigError;
      expect(err.category).toBe("config");
      // 0 を「余裕なし」と読んだ人に、何を指定する値なのかを言う。
      expect(err.hint).toContain("fraction of the limit");
      expect(err.hint).toContain("0.9");
    }
  });

  it.each([
    ["0", { readPerMin: 0 }],
    ["負", { readPerMin: -1 }],
    ["小数", { readPerMin: 10.5 }],
    ["NaN", { readPerMin: Number.NaN }],
    ["Infinity", { readPerMin: Number.POSITIVE_INFINITY }],
  ])("readPerMin が %s なら弾く", (_label, opts) => {
    expect(() => createThrottle(opts)).toThrow(/readPerMin must be/);
  });

  it("上限そのものが不正なときのエラーも category と既定値を持つ", () => {
    try {
      createThrottle({ readPerMin: 0 });
      expect.unreachable("should have thrown");
    } catch (e) {
      const err = e as PortersConfigError;
      expect(err.category).toBe("config");
      // 「分あたりの件数」だと分かること＋既定値。単位を取り違えると直せない。
      expect(err.hint).toContain("per minute");
      expect(err.hint).toContain("2000");
    }
  });

  it("writePerMin も同じように見る（read だけ守っても意味がない）", () => {
    expect(() => createThrottle({ writePerMin: 1 })).toThrow(
      /writePerMin 1 with safety/,
    );
    expect(() => createThrottle({ writePerMin: 0 })).toThrow(
      /writePerMin must be/,
    );
  });

  it("safety を上げれば小さい上限も通る（境界）", () => {
    // floor(1 * 1) = 1 ＝ ちょうど 1 トークン。通るべき最小の組み合わせ。
    expect(() => createThrottle({ readPerMin: 1, safety: 1 })).not.toThrow();
    // floor(2 * 0.9) = 1。hint が案内する「at least 2」がほんとうに通ることの確認。
    expect(() => createThrottle({ readPerMin: 2 })).not.toThrow();
  });

  it("既定の設定は通る", () => {
    expect(() => createThrottle()).not.toThrow();
  });

  it("通る最小の容量（1）は待つだけで、止まりっぱなしにはならない", async () => {
    // 弾く／弾かないの境界のすぐ内側。ここが「待つ」で済むことを示せて初めて、
    // 弾いているのは「待つ」ではなく「永久に返らない」設定だと言える。
    vi.useFakeTimers();
    let t = 0;
    const throttle = createThrottle({
      readPerMin: 1,
      safety: 1,
      now: () => t,
    });
    await throttle.take(false); // 容量 1 ＝ 1 個目は即座に通る
    const pending = throttle.take(false); // 2 個目は待つ
    t = 60_000; // 1 分で 1 トークン戻る
    await vi.advanceTimersByTimeAsync(60_000);
    await pending; // 返る＝ハングではない
    vi.useRealTimers();
  });
});
