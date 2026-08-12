// Point the library at a local fake server **without depending on library support** (ADR-0043
// phase 5).
//
// Since phase 6 (ADR-0047) the library can be aimed at the fake by configuration alone —
// `host` + `scheme: "http"` — which is the way an unmodified app should connect. This Transport
// stays for the cases that setting cannot cover: rewriting scheme + authority on the way out and
// delegating to the normal fetch transport, so everything above it (throttle, retry, auth, XML)
// runs untouched while the app keeps whatever `host` it was configured with.

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
 * Prefer `new PortersClient({ host, scheme: "http" })` (ADR-0047) when the app may be configured;
 * reach for this when it may not.
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
