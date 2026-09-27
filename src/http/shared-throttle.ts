// The process-wide throttle buckets, one per destination (ADR-0073). Building a client per tenant is
// something the guides actively recommend (separate tokens, differing custom catalogs), and before
// this the buckets multiplied with them — silently (RV-43). The registry here is the process-wide
// seam that keeps the sum honest.

import { createThrottle, type Throttle } from "./throttle";

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
export const sharedThrottle = (authority: string): Throttle =>
  processRegistry.forAuthority(authority);

/** Test seam: drop every shared bucket. Not part of the published API. */
export const resetSharedThrottles = (): void => processRegistry.reset();
