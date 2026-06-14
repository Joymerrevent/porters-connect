// Default fetch-based transport (ADR-0009). Thin: one request -> one response;
// throttle/retry/auth live above it. Network/timeout -> PortersNetworkError.

import { PortersNetworkError } from "../errors/index";
import type { Transport } from "./types";

export type FetchTransportOptions = {
  timeoutMs?: number;
  /** Injectable fetch (tests / custom dispatcher). Default global fetch. */
  fetchImpl?: typeof fetch;
};

export const createFetchTransport = (
  opts: FetchTransportOptions = {},
): Transport => {
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  return {
    send: async (req) => {
      try {
        const res = await doFetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
          signal: AbortSignal.timeout(timeoutMs),
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
