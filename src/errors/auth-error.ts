// Authentication API `<Error>` -> category, and the PortersAuthError built from it (ADR-0006).
// Unknown codes fall through to `category: "unknown"` — never swallowed (fail-safe).

import { PortersAuthError, type ErrorCategory } from "./porters-error";

// Authentication API の `<Error>` ごとの category。reference の authentication-api/errors.md の表と、
// 行どうしで突き合わせられる形にしている。
const AUTH_CATEGORIES: ReadonlyMap<number, ErrorCategory> = new Map([
  [400, "auth"],
  [401, "auth"],
  [103, "auth"],
  [104, "auth"],
  [105, "auth"],
  [106, "auth"],
  [107, "auth"],
  [109, "auth"],
  [114, "auth"],
  [117, "auth"],
  [100, "validation"],
  [101, "validation"],
  [102, "validation"],
  [110, "validation"],
  [112, "validation"],
  [111, "permission"],
  [115, "permission"],
  [116, "permission"],
  [402, "permission"],
  [108, "server"],
]);

/** Authentication API `<Error>` -> category (ADR-0006). */
export const authCategory = (code: number): ErrorCategory =>
  AUTH_CATEGORIES.get(code) ?? "unknown";

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
