// Point the library at a local fake server **without changing the library** (ADR-0043 phase 5).
//
// The library builds every URL as `https://{host}/v1/...` (10 sites), so a local HTTP server cannot
// be reached by setting `host` alone — making that work is a library change, deferred to phase 6.
// Until then this Transport rewrites scheme + authority on the way out and delegates to the normal
// fetch transport, so everything above it (throttle, retry, auth, XML) runs untouched: an app only
// swaps its `transport`.

import { createFetchTransport } from "../../src/http/fetch-transport";
import type { Transport } from "../../src/http/types";

export type ForwardingTransportOptions = {
  /** Where to send instead, e.g. `http://127.0.0.1:4010`. */
  baseUrl: string;
  /** Injectable fetch (tests). Default global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

// Keep path + query verbatim; replace only where the request goes.
const rewrite = (url: string, baseUrl: string): string => {
  const target = new URL(url);
  const base = new URL(baseUrl);
  target.protocol = base.protocol;
  target.host = base.host;
  return target.toString();
};

/**
 * Build a {@link Transport} that forwards every request to `baseUrl`, keeping path, query, headers
 * and body as the library wrote them.
 *
 * @example
 * const server = await startFakeServer();
 * const porters = new PortersClient({
 *   host: "fake.test", // still whatever the app configures — only the transport is swapped
 *   transport: createForwardingTransport({ baseUrl: server.url }),
 * });
 */
export const createForwardingTransport = (
  options: ForwardingTransportOptions,
): Transport => {
  const inner = createFetchTransport({
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  return {
    send: (request) =>
      inner.send({ ...request, url: rewrite(request.url, options.baseUrl) }),
  };
};
