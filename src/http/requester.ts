// Request pipeline (ADR-0009/0010/0012): throttle -> auth header -> transport,
// with reactive token refresh (401/402) and bounded backoff retry. The
// idempotency guard keeps non-idempotent writes (create) from double-applying.

import type { TokenProvider } from "../auth/types";
import {
  PortersConfigError,
  PortersError,
  PortersNetworkError,
} from "../errors/index";
import type { Backoff } from "./retry";
import type { Throttle } from "./throttle";
import type { Transport, TransportRequest } from "./types";

const API_VERSION = "2";

// docs/reference: keep a whole request under ~15000 chars (a larger payload 400s).
// A future 16KB cap is planned but undetermined — follow the canonical value.
const MAX_REQUEST_LENGTH = 15000;

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
    "X-P-ConnectAPI-Version": API_VERSION,
    ...(write ? { "Content-Type": "application/xml; charset=UTF-8" } : {}),
  },
});

export type RequesterOptions = {
  transport: Transport;
  auth: TokenProvider;
  throttle: Throttle;
  backoff: Backoff;
  maxRetries?: number;
};

export type RequestSpec = {
  /** Write (POST) uses the write throttle bucket. */
  write?: boolean;
  /** false for non-idempotent ops (create); not auto-retried on network uncertainty. */
  idempotent?: boolean;
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
    // Eager size guard: block an oversized body before throttle / auth / transport.
    // A clear config error beats an opaque server 400, and we don't burn a throttle
    // token or a token refresh on a request that cannot succeed (fail-safe).
    if (req.body !== undefined && req.body.length > MAX_REQUEST_LENGTH) {
      throw new PortersConfigError(
        `request body is ${req.body.length} characters, over the ~${MAX_REQUEST_LENGTH}-character limit`,
        {
          category: "config",
          hint: "Split the write into smaller batches (PORTERS caps a request at ~15000 chars / 200 records).",
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
      try {
        const token = await o.auth.getAccessToken(
          forceRefresh ? { forceRefresh: true } : undefined,
        );
        forceRefresh = false;
        const res = await o.transport.send(withAuth(req, token, write));
        return parse(res.body);
      } catch (e) {
        if (!(e instanceof PortersError)) throw e;
        // reactive: token expired -> refresh once and retry (safe even for create).
        if ((e.code === 401 || e.code === 402) && !authRetried) {
          authRetried = true;
          forceRefresh = true;
          continue;
        }
        // idempotency guard: non-idempotent write + network-uncertain -> surface.
        if (e instanceof PortersNetworkError && write && !idempotent) throw e;
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
