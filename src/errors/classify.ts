// Code -> category -> retryable classification and PortersError factories
// (ADR-0006 / result-codes.md). Unknown codes fall through to `category:
// "unknown"` — never swallowed (fail-safe). HTTP status -> category lives here
// too (ADR-0044): the reference calls an error "HTTP != 200 *or* <Code> != 0",
// so both halves are classified in the same place.

import {
  PortersAuthError,
  PortersConfigError,
  PortersError,
  PortersNetworkError,
  PortersResourceError,
  type ErrorCategory,
  type PortersErrorContext,
} from "./porters-error";

const RESOURCE_VALIDATION = new Set([8, 124, 126, 127, 133, 146, 500]);

/** Resource API `<Code>` -> category (ADR-0006). */
export const resourceCategory = (code: number): ErrorCategory => {
  if (code === 9 || code === 302) return "transient";
  if (code === 401 || code === 402) return "auth";
  if (
    code === 6 ||
    code === 400 ||
    code === 403 ||
    code === 406 ||
    code === 601
  )
    return "permission";
  if (code === 7 || code === 404) return "notFound";
  if (code === 301 || code === 303 || code === 304) return "conflict";
  if (code === 1000) return "server";
  if (RESOURCE_VALIDATION.has(code) || (code >= 100 && code <= 116))
    return "validation";
  return "unknown";
};

/** Authentication API `<Error>` -> category (ADR-0006). */
export const authCategory = (code: number): ErrorCategory => {
  if (code === 400) return "auth";
  if ([401, 103, 104, 105, 106, 107, 109, 114, 117].includes(code))
    return "auth";
  if ([100, 101, 102, 110, 112].includes(code)) return "validation";
  if ([111, 115, 116, 402].includes(code)) return "permission";
  if (code === 108) return "server";
  return "unknown";
};

const resourceHint = (code: number): string | undefined => {
  if (code === 403)
    return "No data permission. Run the initial browser `code` grant for this Company DB, or check scopes.";
  if (code === 404)
    return "Partition not found or outside the contract period. Verify the partition id.";
  return undefined;
};

/** Build a PortersResourceError from a Resource API `<Code>`. */
export const resourceError = (
  code: number,
  message: string,
  context?: PortersErrorContext,
): PortersResourceError => {
  const category = resourceCategory(code);
  return new PortersResourceError(message, {
    category,
    code,
    retryable: category === "transient",
    hint: resourceHint(code),
    context,
  });
};

/** Build a PortersAuthError from an Authentication API `<Error>`. */
export const authError = (code: number, message: string): PortersAuthError => {
  const category = authCategory(code);
  return new PortersAuthError(message, {
    category,
    code,
    retryable: false,
    hint:
      category === "auth"
        ? "Authentication failed; re-authenticate (browser `code` grant) or check app credentials."
        : undefined,
  });
};

/** Build a PortersNetworkError (no PORTERS code; retryable for idempotent ops). */
export const networkError = (
  message: string,
  cause?: unknown,
): PortersNetworkError =>
  new PortersNetworkError(message, {
    category: "network",
    retryable: true,
    cause,
  });

/**
 * HTTP status -> category, for a response whose body is **not** a PORTERS envelope (ADR-0044).
 * Reaching here means an intermediary answered instead of the API — a load balancer, proxy, WAF
 * or maintenance page — so there is no `<Code>` to trust and the status is all we have.
 *
 * VERIFY(live): which statuses real PORTERS returns is unconfirmed; the reference documents the
 * limits, not the responses. See docs/live-verification.md (LV-9).
 */
export const httpStatusCategory = (status: number): ErrorCategory => {
  if (status >= 500) return "server";
  if (status === 429) return "rateLimit";
  if (status === 408) return "network";
  if (status === 401 || status === 403) return "permission";
  if (status >= 400) return "config";
  return "unknown";
};

// Worth another attempt: the failure is in the transport path, not in the request itself. The
// requester still refuses to replay a non-idempotent write on a `PortersNetworkError`, which is
// why these are network errors — a 5xx leaves it unknown whether the write applied (ADR-0010).
const RETRYABLE_HTTP_CATEGORIES = new Set<ErrorCategory>([
  "server",
  "rateLimit",
  "network",
]);

const httpStatusHint = (category: ErrorCategory): string | undefined => {
  if (category === "server")
    return "The API — or an intermediary in front of it (load balancer / proxy / maintenance page) — failed. Transient: idempotent calls are retried with backoff.";
  if (category === "rateLimit")
    return "Too many requests. The library paces itself under the per-minute caps; slow down, batch, or retry later.";
  if (category === "network")
    return "The request timed out on the way to PORTERS. Retry; if it persists, check the network path.";
  if (category === "permission")
    return "Rejected before PORTERS answered. Check the token and scopes, and any gateway (proxy / WAF / IP allow-list) in front of the API.";
  if (category === "config")
    return "The response did not come from the PORTERS API. Check `host` / `scheme` and anything routing the request.";
  return "Neither a PORTERS envelope nor a recognised HTTP failure — inspect `httpStatus` and the intermediary that produced it.";
};

/**
 * Build the error for an HTTP-level failure whose body carries no PORTERS envelope (ADR-0044).
 * `code` stays `null` — there is no PORTERS code — and `httpStatus` carries the status so callers
 * can judge for themselves. `cause` keeps whatever reading the body did produce.
 */
export const httpStatusError = (
  status: number,
  cause?: unknown,
): PortersError => {
  const category = httpStatusCategory(status);
  const message = `HTTP ${status} without a PORTERS response body`;
  const options = {
    category,
    code: null,
    retryable: RETRYABLE_HTTP_CATEGORIES.has(category),
    hint: httpStatusHint(category),
    httpStatus: status,
    cause,
  };
  if (category === "permission") return new PortersAuthError(message, options);
  if (category === "config") return new PortersConfigError(message, options);
  // Unknown source, unknown status: the base class is the honest answer (fail-safe — never
  // claim an origin we cannot back up).
  if (category === "unknown") return new PortersError(message, options);
  return new PortersNetworkError(message, options);
};

/**
 * Stamp the HTTP status onto an error raised while parsing that same response (ADR-0044).
 * The parsers know the PORTERS `<Code>` but not the status; the requester knows the status but
 * not the code — this is the one seam where both are in hand. Called before the error leaves the
 * requester, so callers still observe an immutable error.
 */
export const withHttpStatus = <E extends PortersError>(
  error: E,
  httpStatus: number,
): E => {
  (error as { httpStatus?: number }).httpStatus = httpStatus;
  return error;
};
