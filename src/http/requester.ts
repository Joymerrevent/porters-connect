// Request pipeline (ADR-0009/0010/0012): throttle -> auth header -> transport,
// with reactive token refresh (401/402) and bounded backoff retry. The
// idempotency guard keeps non-idempotent writes (create) from double-applying —
// it fires only when the write was actually sent and its outcome is unknown (ADR-0063).
// The response is read through both error channels — HTTP status and PORTERS
// envelope — by the shared `readResponse` (ADR-0044 / ADR-0050).

import {
  PortersConfigError,
  PortersError,
  PortersNetworkError,
  PortersResourceError,
} from "../errors/index";
import { readResponse } from "./read-response";
import type { Backoff } from "./backoff";
import type { Throttle } from "./throttle";
import type { AccessTokenSource, Transport, TransportRequest } from "./types";
import { CONNECT_API_VERSION, MAX_REQUEST_LENGTH } from "../porters/request";

// The Connect API Version sent and the request-size cap are PORTERS values (porters/request.ts).

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const withAuth = (
  req: TransportRequest,
  token: string,
  write: boolean,
): TransportRequest => ({
  ...req,
  headers: {
    ...req.headers,
    "X-porters-hrbc-oauth-token": token,
    "X-P-ConnectAPI-Version": CONNECT_API_VERSION,
    ...(write ? { "Content-Type": "application/xml; charset=UTF-8" } : {}),
  },
});

export type RequesterOptions = {
  transport: Transport;
  auth: AccessTokenSource;
  throttle: Throttle;
  backoff: Backoff;
  maxRetries?: number;
};

export type RequestSpec = {
  /** Write (POST) uses the write throttle bucket. */
  write?: boolean;
  /** false for non-idempotent ops (create); not auto-retried on network uncertainty. */
  idempotent?: boolean;
  /** Skip the ~15000-char size guard (file uploads have their own limit; ADR-0018). */
  unboundedBody?: boolean;
};

export type Requester = {
  request<T>(
    req: TransportRequest,
    parse: (body: string) => T,
    spec?: RequestSpec,
  ): Promise<T>;
};

export const createRequester = (o: RequesterOptions): Requester => {
  const maxRetries = o.maxRetries ?? 3;

  const request = async <T>(
    req: TransportRequest,
    parse: (body: string) => T,
    spec: RequestSpec = {},
  ): Promise<T> => {
    // Eager size guard: block an oversized request before throttle / auth / transport.
    // A clear config error beats an opaque server 400, and we don't burn a throttle token
    // or a token refresh on a request that cannot succeed (fail-safe). PORTERS limits the
    // whole request, so measure URL + body: a write's body or a read's field/condition
    // query string can blow the cap (RV-5). File uploads opt out via `unboundedBody` (the
    // body has its own limit — ADR-0018; their write URL is short, so skipping is safe).
    const requestLength = req.url.length + (req.body?.length ?? 0);
    if (!spec.unboundedBody && requestLength > MAX_REQUEST_LENGTH) {
      throw new PortersConfigError(
        `request is ${requestLength} characters, over the ~${MAX_REQUEST_LENGTH}-character limit`,
        {
          category: "config",
          hint: "Shorten the request: narrow a read's field/condition, or split a write into batches of 200 or fewer records (PORTERS caps a request at ~15000 characters).",
        },
      );
    }
    const write = spec.write ?? false;
    const idempotent = spec.idempotent ?? !write;
    let authRetried = false;
    let forceRefresh = false;
    let attempt = 0;

    for (;;) {
      await o.throttle.take(write);
      // Whether *this* attempt reached the wire. The idempotency guard needs "the write may have
      // applied", not "the error is a network one" (ADR-0063): a token fetch that fails never put
      // the request on the wire, so replaying it cannot duplicate anything.
      let sent = false;
      try {
        const token = await o.auth.getAccessToken(
          forceRefresh ? { forceRefresh: true } : undefined,
        );
        forceRefresh = false;
        sent = true;
        const res = await o.transport.send(withAuth(req, token, write));
        return readResponse(res, parse);
      } catch (e) {
        if (!(e instanceof PortersError)) throw e;
        // reactive: token expired -> refresh once and retry (safe even for create). Only the
        // Resource API's 401 / 402 mean "Access Token expired": the Authentication API numbers its
        // codes separately (its 401 is "Refresh Token expired", raised while fetching the token), and
        // forcing another refresh on that only repeats the request that just failed.
        if (
          e instanceof PortersResourceError &&
          (e.code === 401 || e.code === 402) &&
          !authRetried
        ) {
          authRetried = true;
          forceRefresh = true;
          continue;
        }
        // idempotency guard (ADR-0010 / ADR-0063): stop a non-idempotent write only when it was
        // sent *and* the outcome is unknown. Two failures are known not to have applied:
        //   - `sent === false` — the request never left (token fetch / pre-send failure).
        //   - `rateLimit` — HTTP 429 means it was refused before being processed.
        // VERIFY(live): that a 429 is always a pre-processing refusal is unconfirmed — PORTERS is
        // expected to drop the connection instead, so 429 comes from an intermediary. See
        // docs/live-verification.md (LV-9).
        const mayHaveApplied = sent && e.category !== "rateLimit";
        if (
          mayHaveApplied &&
          e instanceof PortersNetworkError &&
          write &&
          !idempotent
        )
          throw e;
        // transient (9/302) / network -> bounded backoff.
        if (e.retryable && attempt < maxRetries) {
          attempt += 1;
          await sleep(o.backoff(attempt - 1));
          continue;
        }
        throw e;
      }
    }
  };

  return { request };
};
