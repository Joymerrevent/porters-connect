// Default fetch-based transport (ADR-0009). Thin: one request -> one response;
// throttle/retry/auth live above it. Network/timeout -> PortersNetworkError.
//
// Public since ADR-0077: the timeout is the one thing a caller may genuinely need to change
// (a 10MB attachment on a slow link — ADR-0075), and the alternative was writing a whole
// Transport by hand, which means re-implementing the PortersNetworkError wrapping below.

import { PortersConfigError, PortersNetworkError } from "../errors/index";
import type { Transport } from "./types";

/** Default per-request timeout: 30 seconds (ADR-0077). */
const DEFAULT_TIMEOUT_MS = 30_000;

// Node のタイマーが扱える最大値。これを超えると AbortSignal.timeout が 1ms に丸めるか RangeError に
// なり、すべてのリクエストが「通信が不安定」に見える形で失敗する（RV-77）。
const MAX_TIMEOUT_MS = 2_147_483_647;

export type FetchTransportOptions = {
  // 既定 30 秒と「0 は no timeout ではない」は ADR-0077。
  /**
   * How long one request may take, in milliseconds. Default 30,000.
   *
   * **It covers the whole exchange** — connect, send, and reading the response body to the end —
   * because the abort signal is handed to `fetch` itself. A large download therefore hits it even
   * when the headers came back instantly. It is **per request**, so a retried call can take
   * `maxRetries + 1` times this (plus backoff), and it does not include waiting for a throttle
   * slot (throttling sits above the transport).
   *
   * Raise it to read large attachments over a slow link; lower it to fail fast in an interactive
   * tool. Must be a positive integer, at most 2,147,483,647 (about 24.8 days — the longest timer
   * Node can set) — `0` would abort every request immediately, which reads like "no timeout" and
   * is not.
   */
  timeoutMs?: number;
  /** Injectable fetch (tests / custom dispatcher). Default global fetch. */
  fetchImpl?: typeof fetch;
};

export const createFetchTransport = (
  opts: FetchTransportOptions = {},
): Transport => {
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // Checked once, here, rather than on every send: a bad timeout is a configuration mistake and
  // the same mistake on every request (ADR-0048's line). `0` and negatives are the ones that
  // matter — `AbortSignal.timeout(0)` aborts immediately, so every call would fail as a network
  // error and read as "the server is down" instead of "this config cannot work".
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new PortersConfigError(
      `timeoutMs must be a positive integer up to ${MAX_TIMEOUT_MS}, got ${JSON.stringify(opts.timeoutMs)}`,
      {
        category: "config",
        hint: `Pass milliseconds (default ${DEFAULT_TIMEOUT_MS}, at most ${MAX_TIMEOUT_MS}). Raise it for large attachments; there is no "no timeout" value.`,
      },
    );
  }
  return {
    send: async (req) => {
      try {
        const res = await doFetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
          signal: AbortSignal.timeout(timeoutMs),
          // リダイレクトを追いかけない。追いかけると、トークンのヘッダや本文の App Secret を
          // 別の宛先へ送る（RV-76）。3xx はそのまま応答として返し、読む側がエラーにする。
          redirect: "manual",
        });
        return { status: res.status, body: await res.text() };
      } catch (cause) {
        throw new PortersNetworkError("transport request failed", {
          category: "network",
          retryable: true,
          cause,
        });
      }
    },
  };
};
