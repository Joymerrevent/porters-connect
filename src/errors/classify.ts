// Code -> category -> retryable classification and PortersError factories
// (ADR-0006 / result-codes.md). Unknown codes fall through to `category:
// "unknown"` — never swallowed (fail-safe).

import {
  PortersAuthError,
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
