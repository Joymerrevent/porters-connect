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
  // 5（ユーザー ID 無効）はトークンに結びついたユーザーの問題（ADR-0106 案2A）。auth は「断られた」分類なので、
  // 一括書き込みは Code 5 のバッチを書き込まれていないとみる。
  // VERIFY(live): Code 5 が処理の前に断る応答か（途中まで書き込むことが無いか）は未確認 —
  // docs/live-verification.md (LV-39)。
  [5, "auth"],
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
  // 9 は一時的な不調のほか、呼び出し側の環境（x-forwarded-for ヘッダ・GAS・Cloudflare Workers）でも出る
  // （result-codes.md）。後者は再試行しても直らないので、再試行が尽きたときに原因へたどり着けるよう案内する（RV-159）。
  if (code === 9)
    return "PORTERS is temporarily unavailable; the library retries this code with backoff. If it keeps coming back, check the calling side: a proxy that adds an x-forwarded-for header (remove it before the request reaches PORTERS), or running on Google Apps Script or Cloudflare Workers, where PORTERS may not respond as expected.";
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
