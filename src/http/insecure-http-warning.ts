// The plain-http warning (ADR-0047). Allowing http and staying quiet about it are deliberately
// separate concerns: `scheme: "http"` is enough to *connect*, never enough to *silence*. Only the
// dedicated env var below does that, so a cleartext access point can never be configured by
// accident and go unnoticed — including on loopback, because a local fake and a production host
// that lost its TLS look identical from here (fail-safe).
//
// Once per process, not per request: a warning repeated on every call is one a reader learns to
// scroll past. The latch is state, so it lives in a factory (ADR-0013) and the process-wide
// instance is built from it below.

import type { Scheme } from "../types/index";

/** Env var that silences the plain-http warning. Set it only where cleartext is intended. */
export const SUPPRESS_INSECURE_HTTP_WARNING_ENV =
  "PORTERS_SUPPRESS_INSECURE_HTTP_WARNING";

// "Unset or explicitly off" keeps the warning: an ambiguous value must not buy silence.
const OFF_VALUES = new Set(["", "0", "false"]);

const suppressed = (): boolean => {
  const value = process.env[SUPPRESS_INSECURE_HTTP_WARNING_ENV];
  return value !== undefined && !OFF_VALUES.has(value.trim().toLowerCase());
};

export type InsecureSchemeWarner = {
  /**
   * Warn that the access point is plain http — at most once for this warner. A no-op for `https`
   * (and for no scheme at all), and while {@link SUPPRESS_INSECURE_HTTP_WARNING_ENV} is set to
   * anything other than `0` / `false` / empty.
   */
  warn(scheme: Scheme | undefined, host: string): void;
  /** Forget that the warning was emitted (test seam). */
  reset(): void;
};

export const createInsecureSchemeWarner = (): InsecureSchemeWarner => {
  let warned = false;
  return {
    warn: (scheme, host) => {
      // Suppression is checked before the latch is set: a warning nobody saw is not one delivered,
      // so dropping the env var later must still produce it.
      if (scheme !== "http" || warned || suppressed()) return;
      warned = true;
      console.warn(
        `[porters-connect] scheme: "http" — requests to ${host} (the OAuth token header included) ` +
          "are sent in cleartext. Use https unless this is a local fake server or a trusted tunnel. " +
          `Set ${SUPPRESS_INSECURE_HTTP_WARNING_ENV}=1 to silence this warning.`,
      );
    },
    reset: () => {
      warned = false;
    },
  };
};

// "Once per process" is exactly one latch for the whole program.
const processWarner = createInsecureSchemeWarner();

/** Warn (once per process) that the configured access point is plain http. */
export const warnIfInsecureScheme = (
  scheme: Scheme | undefined,
  host: string,
): void => processWarner.warn(scheme, host);

/** Test seam: clear the once-per-process latch. Not part of the published API. */
export const resetInsecureSchemeWarning = (): void => processWarner.reset();
