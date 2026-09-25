// Token-bucket throttle (ADR-0010): per-minute Read/Write limits at ~90% safety.
// Bursts are allowed up to capacity; the average stays under the limit.
//
// **One bucket per host, not per client** (ADR-0073). PORTERS counts what its host receives,
// so a process that builds several clients for the same host must still add up to one limit.
// Building a client per tenant is something the guides actively recommend (separate tokens,
// differing custom catalogs), and before this the buckets multiplied with them — silently
// (RV-43). The registry below is the process-wide seam that keeps the sum honest.

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
   * integer, and **`readPerMin * safety` must still leave at least one token** — see
   * {@link ThrottleOptions.safety}.
   */
  readPerMin?: number;
  /** Writes allowed per minute before headroom. Default 500. Same rules as `readPerMin`. */
  writePerMin?: number;
  // 容量 0 を構築時に弾く判断は RV-49。
  /**
   * Fraction of the limit to actually use (headroom). Default 0.9. Greater than 0, at most 1.
   *
   * The bucket holds `floor(limit * safety)` tokens, so a small limit and a small `safety`
   * multiply into **zero capacity** — `{ readPerMin: 1 }` at the default 0.9 already does.
   * A bucket that can never hold a token would make every call wait forever, so the
   * combination is rejected at construction rather than hanging.
   */
  safety?: number;
  now?: () => number;
};

/**
 * Turn one limit into the bucket's capacity, refusing a combination that cannot work.
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

const makeBucket = (
  capacity: number,
  now: () => number,
): (() => Promise<void>) => {
  const ratePerMs = capacity / 60_000;
  let tokens = capacity;
  let last = now();
  return async () => {
    for (;;) {
      const t = now();
      tokens = Math.min(capacity, tokens + (t - last) * ratePerMs);
      last = t;
      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      await sleep(Math.ceil((1 - tokens) / ratePerMs));
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
  const now = opts.now ?? (() => Date.now());
  const read = makeBucket(
    capacityOf(opts.readPerMin ?? READS_PER_MINUTE, safety, "readPerMin"),
    now,
  );
  const write = makeBucket(
    capacityOf(opts.writePerMin ?? WRITES_PER_MINUTE, safety, "writePerMin"),
    now,
  );
  return { take: (isWrite) => (isWrite ? write() : read()) };
};

/**
 * Hands out one {@link Throttle} per **destination** (ADR-0073). The key is the access point's
 * authority — hostname, plus `:port` when one is configured (ADR-0078) — lower-cased, since a host
 * name is case-insensitive. Every client aimed at the same PORTERS shares a bucket, while a local
 * fake on another name **or another port** keeps its own.
 *
 * State lives in a factory (ADR-0013); the process-wide instance is built from it below.
 */
export type ThrottleRegistry = {
  /** The bucket for `authority`, created on first use and reused afterwards. */
  forAuthority(authority: string): Throttle;
  /** Drop every bucket (test seam). */
  reset(): void;
};

export const createThrottleRegistry = (
  make: () => Throttle = () => createThrottle(),
): ThrottleRegistry => {
  const buckets = new Map<string, Throttle>();
  return {
    forAuthority: (authority) => {
      // 大小を畳むのが目的で、どちらへ畳むかは結果に効かない（`toUpperCase` でも同じ）。
      // Stryker disable next-line MethodExpression: equivalent — どちらの case fold でも同じキーになる
      const key = authority.toLowerCase();
      const known = buckets.get(key);
      if (known !== undefined) return known;
      const created = make();
      buckets.set(key, created);
      return created;
    },
    reset: () => buckets.clear(),
  };
};

// "One limit per destination" is exactly one registry for the whole program.
const processRegistry = createThrottleRegistry();

/**
 * The process-wide bucket for `authority` (`hostname` or `hostname:port` — ADR-0078). A client uses
 * this unless the caller injected its own {@link Throttle} — see `PortersClientOptions.throttle`.
 */
// VERIFY(live): the reference states the per-minute caps but never says **what they are counted
// per** — App, contract, or host. Host is assumed because a host is issued per contract, so
// "host ≒ contract" — docs/live-verification.md (LV-23). The assumption fails safe (sharing more
// widely means calling less), so if it turns out to be per-App the key gains the App id.
export const sharedThrottleFor = (authority: string): Throttle =>
  processRegistry.forAuthority(authority);

/** Test seam: drop every shared bucket. Not part of the published API. */
export const resetSharedThrottles = (): void => processRegistry.reset();
