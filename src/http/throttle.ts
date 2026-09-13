// Token-bucket throttle (ADR-0010): per-minute Read/Write limits at ~90% safety.
// Bursts are allowed up to capacity; the average stays under the limit.
//
// **One bucket per host, not per client** (ADR-0073). PORTERS counts what its host receives,
// so a process that builds several clients for the same host must still add up to one limit.
// Building a client per tenant is something the guides actively recommend (separate tokens,
// differing custom catalogs), and before this the buckets multiplied with them — silently
// (RV-43). The registry below is the process-wide seam that keeps the sum honest.

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export type Throttle = {
  take(write: boolean): Promise<void>;
};

export type ThrottleOptions = {
  readPerMin?: number;
  writePerMin?: number;
  /** Fraction of the limit to actually use (headroom). Default 0.9. */
  safety?: number;
  now?: () => number;
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
  const now = opts.now ?? (() => Date.now());
  const read = makeBucket(Math.floor((opts.readPerMin ?? 2000) * safety), now);
  const write = makeBucket(Math.floor((opts.writePerMin ?? 500) * safety), now);
  return { take: (isWrite) => (isWrite ? write() : read()) };
};

/**
 * Hands out one {@link Throttle} per host (ADR-0073). The key is the bare host of the access point
 * (lower-cased — a host is case-insensitive), so every client aimed at the same PORTERS shares a
 * bucket while a local fake on another host keeps its own.
 *
 * State lives in a factory (ADR-0013); the process-wide instance is built from it below.
 */
export type ThrottleRegistry = {
  /** The bucket for `host`, created on first use and reused afterwards. */
  forHost(host: string): Throttle;
  /** Drop every bucket (test seam). */
  reset(): void;
};

export const createThrottleRegistry = (
  make: () => Throttle = () => createThrottle(),
): ThrottleRegistry => {
  const buckets = new Map<string, Throttle>();
  return {
    forHost: (host) => {
      const key = host.toLowerCase();
      const known = buckets.get(key);
      if (known !== undefined) return known;
      const created = make();
      buckets.set(key, created);
      return created;
    },
    reset: () => buckets.clear(),
  };
};

// "One limit per host" is exactly one registry for the whole program.
const processRegistry = createThrottleRegistry();

/**
 * The process-wide bucket for `host`. A client uses this unless the caller injected its own
 * {@link Throttle} — see `PortersClientOptions.throttle`.
 */
export const sharedThrottleFor = (host: string): Throttle =>
  processRegistry.forHost(host);

/** Test seam: drop every shared bucket. Not part of the published API. */
export const resetSharedThrottles = (): void => processRegistry.reset();
