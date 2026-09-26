// Resource API `<Code>` -> category -> retryable, and the PortersResourceError built from it
// (ADR-0006 / result-codes.md). Unknown codes fall through to `category: "unknown"` — never
// swallowed (fail-safe).

import {
  PortersResourceError,
  type ErrorCategory,
  type PortersErrorContext,
} from "./porters-error";

// Result Code ごとの category。reference の resource-api/result-codes.md の表と、
// 行どうしで突き合わせられる形にしている。
const RESOURCE_CATEGORIES: ReadonlyMap<number, ErrorCategory> = new Map([
  [9, "transient"],
  [302, "transient"],
  [401, "auth"],
  [402, "auth"],
  [6, "permission"],
  [400, "permission"],
  [403, "permission"],
  [406, "permission"],
  [601, "permission"],
  [7, "notFound"],
  [404, "notFound"],
  [301, "conflict"],
  [303, "conflict"],
  [304, "conflict"],
  [1000, "server"],
  [8, "validation"],
  [124, "validation"],
  [126, "validation"],
  [127, "validation"],
  [133, "validation"],
  [146, "validation"],
  [500, "validation"],
]);

/** Resource API `<Code>` -> category (ADR-0006). */
export const resourceCategory = (code: number): ErrorCategory => {
  const category = RESOURCE_CATEGORIES.get(code);
  if (category !== undefined) return category;
  // 100〜116 は入力の誤り（項目の値・条件の書き方）がまとまった範囲。
  if (code >= 100 && code <= 116) return "validation";
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
