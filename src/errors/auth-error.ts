// Authentication API `<Error>` -> category, and the PortersAuthError built from it (ADR-0006).
// Unknown codes fall through to `category: "unknown"` — never swallowed (fail-safe).

import { PortersAuthError, type ErrorCategory } from "./porters-error";

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
