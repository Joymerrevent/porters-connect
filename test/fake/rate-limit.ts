// The Resource API's request caps (docs/reference: 1 分あたり Read 2000 / Write 500、月 約15万アクセス).
//
// What exceeding them *looks like* is the interesting part: the reference says the connection may
// be forcibly closed and explicitly notes that **no HTTP 429 / Retry-After is documented**, so the
// default here is a dropped connection — which surfaces as a retryable `PortersNetworkError`, the
// same shape a real `fetch` failure takes. `http429` is available for exercising the other reading.
// VERIFY(live): see docs/live-verification.md (LV-9).
//
// The library throttles itself to 90% of the per-minute caps (ADR-0010), so a well-behaved caller
// never trips this; a test that wants the failure lowers the caps.

import type { FakeRateLimit } from "./types";

/** Which bucket a request counts against. */
export type RateBucket = "read" | "write";

export type RateLimiter = {
  /** Record one request; `false` means it exceeded a cap and must be rejected. */
  take(bucket: RateBucket): boolean;
  mode: "disconnect" | "http429";
  reset(): void;
};

const DEFAULT_READ_PER_MINUTE = 2000;
const DEFAULT_WRITE_PER_MINUTE = 500;
// Contractual, not an API-documented limit: ~150,000 accesses per month (gotchas.md). The window is
// a rolling 30 days — the real quota is presumably calendar-month based, which the fake does not
// model (LV-9).
const DEFAULT_PER_MONTH = 150_000;
const MINUTE_MS = 60_000;
const MONTH_MS = 30 * 24 * 60 * MINUTE_MS;

export const createRateLimiter = (
  config: FakeRateLimit | false | undefined,
  now: () => number,
): RateLimiter => {
  const enabled = config !== false;
  const settings: FakeRateLimit =
    config === false || config === undefined ? {} : config;
  const caps = {
    read: settings.readPerMinute ?? DEFAULT_READ_PER_MINUTE,
    write: settings.writePerMinute ?? DEFAULT_WRITE_PER_MINUTE,
  };
  const monthly = settings.perMonth ?? DEFAULT_PER_MONTH;
  let hits: { at: number; bucket: RateBucket }[] = [];

  return {
    mode: settings.mode ?? "disconnect",
    take: (bucket) => {
      if (!enabled) return true;
      const t = now();
      // Drop everything outside the longest window, then count each window from what is left.
      hits = hits.filter((hit) => t - hit.at < MONTH_MS);
      if (hits.length >= monthly) return false;
      const inMinute = hits.filter(
        (hit) => hit.bucket === bucket && t - hit.at < MINUTE_MS,
      ).length;
      if (inMinute >= caps[bucket]) return false;
      hits.push({ at: t, bucket });
      return true;
    },
    reset: () => {
      hits = [];
    },
  };
};
