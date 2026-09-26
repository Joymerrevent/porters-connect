import { describe, expect, it, vi } from "vitest";

import { PortersConfigError } from "../errors/index";

import { createThrottle } from "./throttle";

// Flush pending microtasks (an immediate take() resolves without a timer).
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("createThrottle (sliding window, ADR-0102)", () => {
  it("lets the capacity through at once, then waits until the oldest request is a minute old", async () => {
    vi.useFakeTimers();
    let t = 0;
    // readPerMin 60 * safety 1.0 = capacity 60.
    const throttle = createThrottle({
      readPerMin: 60,
      safety: 1,
      now: () => t,
    });
    for (let i = 0; i < 60; i++) await throttle.take(false); // all at t = 0

    let settled = false;
    const pending = throttle.take(false).then(() => {
      settled = true;
    });
    t = 59_999; // still inside the minute of the first 60
    await vi.advanceTimersByTimeAsync(59_999);
    expect(settled).toBe(false);
    t = 60_000; // the first 60 leave the window
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toBe(true);
    vi.useRealTimers();
  });

  it("sleeps exactly until the oldest request leaves the window", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    let t = 0;
    const throttle = createThrottle({
      readPerMin: 60,
      safety: 1,
      now: () => t,
    });
    await throttle.take(false); // the oldest, at t = 0
    t = 1000;
    for (let i = 0; i < 59; i++) await throttle.take(false); // full at t = 1000

    t = 1500;
    void throttle.take(false); // blocks until t = 60_000
    const delays = setTimeoutSpy.mock.calls.map((c) => Number(c[1]));
    expect(delays.at(-1)).toBe(58_500);

    setTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });

  // ADR-0102 の性質そのもの。token-bucket は満杯から始めて毎分補充するので、起動直後の 60 秒で
  // 容量の約 2 倍を通していた（RV-66）。どの 60 秒を切り取っても容量以下であることを、
  // 休まず呼び続けたときの時刻の列で確かめる。
  it("never lets more than the capacity through in any 60 seconds", async () => {
    vi.useFakeTimers({ now: 0 });
    const capacity = 10;
    const throttle = createThrottle({
      readPerMin: capacity,
      safety: 1,
      now: () => Date.now(),
    });
    const times: number[] = [];
    for (let i = 0; i < capacity * 3 + 5; i++) {
      let done = false;
      const p = throttle.take(false).then(() => {
        done = true;
      });
      while (!done) await vi.advanceTimersToNextTimerAsync();
      await p;
      times.push(Date.now());
    }
    // 窓の外に出るまでは次の容量ぶんを通さない＝ times[i + capacity] は times[i] から 60 秒以上あと。
    for (let i = 0; i + capacity < times.length; i++) {
      expect(times[i + capacity] - times[i]).toBeGreaterThanOrEqual(60_000);
    }
    // ただし待ちすぎない: 容量ぶんは最初に通り、次の容量ぶんはちょうど 60 秒後に通る。
    expect(times.slice(0, capacity)).toEqual(Array(capacity).fill(0));
    expect(times[capacity]).toBe(60_000);
    vi.useRealTimers();
  });

  it("measures time with performance.now() by default, which never goes backwards", async () => {
    const spy = vi.spyOn(performance, "now").mockReturnValue(123);
    const throttle = createThrottle({ readPerMin: 60, safety: 1 });
    await throttle.take(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("uses the write window for writes", async () => {
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

  it("meters writes through a separate window sized by writePerMin", async () => {
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
});

// RV-49。容量 0 のスロットルは「1 ミリ秒ごとに起きて空きを待つ」ループになり、**永久に返らない**。
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
