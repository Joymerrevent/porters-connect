// Limits and headers PORTERS sets for every request (ADR-0098). The code that enforces them lives
// in http/ (the request guard, the throttle) and imports the values from here.

// 互換性の契約は Connect API Version 2（ADR-0042）。
/** The Connect API Version the library speaks (PORTERS accepts 1 and 2; Link etc. need 2). */
export const CONNECT_API_VERSION = "2";

/**
 * docs/usage/reference: keep a *whole* request under ~15000 chars (a larger payload 400s).
 * "Whole" is load-bearing: a write's body dominates, but a read's length lives in the
 * URL (field / condition) — and a fieldless Read sends the catalog default field set, so that
 * URL grew. A future 16KB cap is planned but undetermined — follow the canonical value.
 */
export const MAX_REQUEST_LENGTH = 15000;

/** PORTERS' cap on Read requests per minute. */
export const READS_PER_MINUTE = 2000;

/** PORTERS' cap on Write requests per minute. */
export const WRITES_PER_MINUTE = 500;
