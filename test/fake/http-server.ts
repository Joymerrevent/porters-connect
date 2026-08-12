// The fake behind a real socket (ADR-0043 phase 5): the same behaviour core, reachable over HTTP
// so a separate process — an MCP server, a curl, a scratch script — can talk to it.
//
// Nothing about the core changes: this is a thin adapter that turns an `IncomingMessage` into the
// `TransportRequest` the core already understands, and its answer back into an HTTP response. The
// two failure kinds the core throws map to what they actually mean on a wire:
//
//   PortersNetworkError  -> the socket is destroyed (that *is* the "forced disconnect" the
//                           reference describes for a rate-limit breach)
//   PortersConfigError   -> HTTP 501 + a loud message, since an unimplemented route must not look
//                           like an empty result to a client in another process (fail-safe)
//
// http, not https: the fake needs no certificate, and self-signed TLS was explicitly rejected
// (ADR-0043 D-アクセスポイント / ADR-0047). Since phase 6 the library reaches it by configuration
// alone — `new PortersClient({ host: "127.0.0.1:<port>", scheme: "http" })`; the transport swap in
// `http-transport.ts` remains for apps whose configuration cannot be touched.

import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { PortersNetworkError } from "../../src/errors/index";
import type { Transport, TransportRequest } from "../../src/http/types";
import { createFakeTransport } from "./fake-transport";
import { createForwardingTransport } from "./http-transport";
import type { FakeControl, FakeTransportOptions } from "./types";

export type FakeServerOptions = FakeTransportOptions & {
  /** Port to listen on. `0` (default) picks a free one — read it back from {@link FakeServer.url}. */
  port?: number;
  /** Interface to bind. Default `127.0.0.1` — loopback only, never exposed. */
  hostname?: string;
  /** Where to report unimplemented routes. Default `console.error`; pass `() => {}` to silence. */
  log?: (message: string) => void;
};

export type FakeServer = {
  /** Base URL, e.g. `http://127.0.0.1:53123`. */
  readonly url: string;
  readonly port: number;
  /** The same controls as the in-process fake: fault injection, records, reset. */
  readonly control: FakeControl;
  /** A {@link Transport} pointing the library here, for when `scheme: "http"` is not an option. */
  transport(): Transport;
  close(): Promise<void>;
};

const XML_CONTENT_TYPE = "application/xml; charset=UTF-8";

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
};

const headersOf = (req: IncomingMessage): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(", ");
  }
  return out;
};

/** Start the fake as a local HTTP server. Resolves once it is listening. */
export const startFakeServer = async (
  options: FakeServerOptions = {},
): Promise<FakeServer> => {
  const { port = 0, hostname = "127.0.0.1", log, ...fakeOptions } = options;
  const report = log ?? ((message: string) => console.error(message));
  const fake = createFakeTransport(fakeOptions);

  const server: Server = createServer((req, res) => {
    void (async () => {
      // The core only knows the two verbs PORTERS uses.
      if (req.method !== "GET" && req.method !== "POST") {
        res.writeHead(405, { Allow: "GET, POST" });
        res.end(`fake server: ${req.method ?? "?"} is not a PORTERS method`);
        return;
      }
      const body = req.method === "POST" ? await readBody(req) : undefined;
      const request: TransportRequest = {
        method: req.method,
        url: `http://${hostname}:${(server.address() as AddressInfo).port}${req.url ?? "/"}`,
        headers: headersOf(req),
        body,
      };
      try {
        const answer = await fake.send(request);
        res.writeHead(answer.status, { "Content-Type": XML_CONTENT_TYPE });
        res.end(answer.body);
      } catch (error) {
        if (error instanceof PortersNetworkError) {
          // A closed connection, for real — the client sees exactly what a dropped request looks
          // like rather than a tidy status code it could mistake for an answer.
          req.socket.destroy();
          return;
        }
        const message =
          error instanceof Error ? error.message : "fake server: unknown error";
        report(message);
        res.writeHead(501, { "Content-Type": "text/plain; charset=UTF-8" });
        res.end(message);
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(port, hostname, resolve));
  const actualPort = (server.address() as AddressInfo).port;
  const url = `http://${hostname}:${actualPort}`;

  return {
    url,
    port: actualPort,
    control: fake.control,
    transport: () => createForwardingTransport({ baseUrl: url }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
};
