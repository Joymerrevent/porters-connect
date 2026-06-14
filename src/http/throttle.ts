// Token-bucket throttle (ADR-0010): per-minute Read/Write limits at ~90% safety.
// Bursts are allowed up to capacity; the average stays under the limit.

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
