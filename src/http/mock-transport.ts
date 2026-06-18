// Public mock transport for offline evaluation / unit tests (ADR-0024 / R-17 / R-12).
// It targets the stable public `Transport` seam (not `fetch`), so it survives an internal
// transport change. By default the OAuth code_direct + token endpoints are auto-answered,
// so callers only mock resource XML; an unmocked route fails loud (fail-safe).

import { PortersConfigError } from "../errors/index";
import type { Transport, TransportRequest, TransportResponse } from "./types";

/** A mock reply: an XML body string (HTTP 200), or an explicit status + body. */
export type MockReply = string | { status?: number; body: string };

/**
 * Maps a request to a {@link MockReply}, or returns `undefined` for "not mocked". When `undefined`
 * is returned (and the request is not an auto-answered auth endpoint), the transport throws a
 * {@link PortersConfigError} naming the request, so an unmocked route surfaces instead of silently
 * returning an empty response.
 */
export type MockHandler = (request: TransportRequest) => MockReply | undefined;

/** Options for {@link createMockTransport}. */
export type MockTransportOptions = {
  /**
   * Auto-answer the OAuth `code_direct` (`/v1/oauth`) and token (`/v1/token`) endpoints with valid
   * demo tokens, so callers only mock resource XML. Default `true`. Set `false` to handle the auth
   * endpoints in your own handler.
   */
  auth?: boolean;
};

// Default auth responses (mirrors the live envelope; expiry values are ms — see token-provider).
const AUTH_CODE_XML = `<Authentication><Code>mock-code</Code><Error>0</Error></Authentication>`;
const AUTH_TOKEN_XML =
  `<Authentication>` +
  `<AccessToken>mock-access-token</AccessToken><AccessTokenExpiresIn>1800000</AccessTokenExpiresIn>` +
  `<RefreshToken>mock-refresh-token</RefreshToken><RefreshTokenExpiresIn>7200000</RefreshTokenExpiresIn>` +
  `<Error>0</Error></Authentication>`;

const toResponse = (reply: MockReply): TransportResponse =>
  typeof reply === "string"
    ? { status: 200, body: reply }
    : { status: reply.status ?? 200, body: reply.body };

// method + path だけで「どの route を足すか」は十分。既定 field を載せた Read URL の
// クエリは長大でノイズなので落とす（不正な URL はそのまま出す＝フェイルセーフ）。
const routeLabel = (method: string, url: string): string => {
  try {
    return `${method} ${new URL(url).pathname}`;
  } catch {
    return `${method} ${url}`;
  }
};

/**
 * Build a {@link Transport} that answers from a handler instead of the network — run the library
 * fully offline, with no PORTERS contract (R-17). Pass it as `new PortersClient({ transport })`.
 *
 * @example
 * const transport = createMockTransport((req) =>
 *   req.url.includes("/v1/candidate")
 *     ? `<Candidate Total="0" Count="0" Start="0"><Code>0</Code></Candidate>`
 *     : undefined, // unmocked -> a clear PortersConfigError
 * );
 */
export const createMockTransport = (
  handler: MockHandler,
  options: MockTransportOptions = {},
): Transport => {
  const autoAuth = options.auth ?? true;
  // Non-async on purpose: always return a Promise (resolve/reject) so an unmocked route rejects
  // rather than throwing synchronously — faithful to the Transport contract.
  return {
    send: (req) => {
      if (autoAuth && req.url.includes("/v1/token")) {
        return Promise.resolve({ status: 200, body: AUTH_TOKEN_XML });
      }
      if (autoAuth && req.url.includes("/v1/oauth")) {
        return Promise.resolve({ status: 200, body: AUTH_CODE_XML });
      }
      const reply = handler(req);
      if (reply === undefined) {
        return Promise.reject(
          new PortersConfigError(
            `createMockTransport: no mock response for ${routeLabel(req.method, req.url)} — add a case to your handler` +
              ` (or pass { auth: false } to mock the auth endpoints too)`,
            { category: "config" },
          ),
        );
      }
      return Promise.resolve(toResponse(reply));
    },
  };
};
