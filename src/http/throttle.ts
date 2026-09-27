// Sliding-window throttle (ADR-0010 / ADR-0102): per-minute Read/Write limits at ~90% safety.
// It remembers when each of the last minute's requests went out, so **any 60 seconds** carry at
// most the capacity — whether PORTERS counts a fixed clock minute or the last 60 seconds. A burst
// up to the capacity still goes out at once.
//
// **One throttle per host, not per client** (ADR-0073). PORTERS counts what its host receives,
// so a process that builds several clients for the same host must still add up to one limit.
// The per-host sharing is `shared-throttle.ts`; this file is one throttle.

import { PortersConfigError } from "../errors/index";
import { READS_PER_MINUTE, WRITES_PER_MINUTE } from "../porters/request";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export type Throttle = {
  take(write: boolean): Promise<void>;
};

export type ThrottleOptions = {
  /**
   * Reads allowed per minute before headroom. Default 2000 (PORTERS' own cap). A positive
   * integer, and **`readPerMin * safety` must still let at least one request through** — see
   * {@link ThrottleOptions.safety}.
   */
  readPerMin?: number;
  /** Writes allowed per minute before headroom. Default 500. Same rules as `readPerMin`. */
  writePerMin?: number;
  // 容量 0 を構築時に弾く判断は RV-49。
  /**
   * Fraction of the limit to actually use (headroom). Default 0.9. Greater than 0, at most 1.
   *
   * At most `floor(limit * safety)` requests go out in any 60 seconds, so a small limit and a
   * small `safety` multiply into **zero capacity** — `{ readPerMin: 1 }` at the default 0.9
   * already does. A throttle that can never let a request through would make every call wait
   * forever, so the combination is rejected at construction rather than hanging.
   */
  safety?: number;
  /**
   * The clock, in milliseconds. Default `performance.now()`, which never goes backwards — a wall
   * clock set back an hour would otherwise make every call wait that hour.
   */
  now?: () => number;
};

/**
 * Turn one limit into the throttle's capacity, refusing a combination that cannot work.
 *
 * Checked here rather than per call: this is a configuration mistake, and the same mistake on
 * every request (the line `createFetchTransport` draws for `timeoutMs` — ADR-0077).
 *
 * **The check is on the product, not the inputs.** `readPerMin: 1` and `safety: 0.9` are each
 * perfectly sensible; it is `floor(0.9) = 0` that cannot work. Validating only the inputs would
 * let exactly the realistic case through — someone dialling the rate down to be gentle (RV-49).
 */
const capacityOf = (
  limit: number,
  safety: number,
  option: "readPerMin" | "writePerMin",
): number => {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new PortersConfigError(
      `${option} must be a positive integer, got ${JSON.stringify(limit)}`,
      {
        category: "config",
        hint: "Pass requests per minute (defaults: readPerMin 2000, writePerMin 500).",
      },
    );
  }
  const capacity = Math.floor(limit * safety);
  if (capacity < 1) {
    throw new PortersConfigError(
      `${option} ${limit} with safety ${safety} leaves no capacity (floor(${limit * safety}) = 0), so every call would wait forever`,
      {
        category: "config",
        // 「まったく通さない」を表現したいなら、それ専用の Throttle を書くのが正しい道。
        // 上限 0 を黙って受けて永久に待つのは、許可と沈黙を混ぜる形（ADR-0047 と同じ考え）。
        hint: `Raise ${option} to at least ${Math.ceil(1 / safety)} at this safety, or raise safety. To block every request on purpose, pass your own Throttle whose take() never resolves.`,
      },
    );
  }
  return capacity;
};

const WINDOW_MS = 60_000;

// 直近 60 秒に通した時刻を古い順に持ち、その数が容量に達したら、いちばん古い時刻から 60 秒たつまで待つ。
// どの 60 秒を切り取っても容量を超えない（ADR-0102。token-bucket は満杯から始めて毎分補充するので、
// 起動直後の 60 秒で容量の約 2 倍を通していた。RV-66）。
const makeWindow = (
  capacity: number,
  now: () => number,
): (() => Promise<void>) => {
  // 送った時刻を、容量の長さの輪として持つ（head がいちばん古い時刻、count が窓の中の件数）。
  // 配列の先頭を shift で取り除くと、容量に比例して遅くなる（RV-124）。
  // 初めの中身は結果に効かない（count の外の場所は、読む前に必ず書く）。
  // Stryker disable next-line ArrayDeclaration: equivalent — slots outside count are written before read
  const sent: number[] = [];
  let head = 0;
  let count = 0;
  return async () => {
    for (;;) {
      const t = now();
      // 窓から出た時刻を古い順に捨てる。輪の場所は使い回すので、空かどうかは count で見る。
      while (count > 0 && sent[head] <= t - WINDOW_MS) {
        head = (head + 1) % capacity;
        count -= 1;
      }
      if (count < capacity) {
        sent[(head + count) % capacity] = t;
        count += 1;
        return;
      }
      // 容量に達しているので sent[head] はある。いちばん古い時刻が窓から出るまで待つ。
      await sleep(sent[head] + WINDOW_MS - t);
    }
  };
};

export const createThrottle = (opts: ThrottleOptions = {}): Throttle => {
  const safety = opts.safety ?? 0.9;
  // `safety` first: the limit checks report it, so a nonsensical value must not reach them.
  // `0` is the one that matters — it zeroes every capacity, and reads like "no headroom"
  // rather than "no throughput" (the same trap as `timeoutMs: 0` — ADR-0077).
  if (!(safety > 0) || safety > 1) {
    throw new PortersConfigError(
      `safety must be greater than 0 and at most 1, got ${JSON.stringify(opts.safety)}`,
      {
        category: "config",
        hint: "safety is the fraction of the limit to use (default 0.9 = 90%). Use 1 to run right at PORTERS' cap.",
      },
    );
  }
  const now = opts.now ?? (() => performance.now());
  const read = makeWindow(
    capacityOf(opts.readPerMin ?? READS_PER_MINUTE, safety, "readPerMin"),
    now,
  );
  const write = makeWindow(
    capacityOf(opts.writePerMin ?? WRITES_PER_MINUTE, safety, "writePerMin"),
    now,
  );
  return { take: (isWrite) => (isWrite ? write() : read()) };
};
