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

// Eager size guard: block an oversized request before throttle / auth / transport.
// A clear config error beats an opaque server 400, and we don't burn a throttle token
// or a token refresh on a request that cannot succeed (fail-safe). PORTERS limits the
// whole request, so measure URL + body: a write's body or a read's field/condition
// query string can blow the cap (RV-5). File uploads opt out via `unboundedBody` (the
// body has its own limit — ADR-0018; their write URL is short, so skipping is safe).
const assertRequestLength = (
  req: TransportRequest,
  spec: RequestSpec,
): void => {
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
};

// 1 回の試行が失敗したときに、次にどうするかを決めるための材料。
export type AttemptState = {
  // Whether *this* attempt reached the wire (see `request`).
  sent: boolean;
  authRetried: boolean;
  write: boolean;
  idempotent: boolean;
  attempt: number;
  maxRetries: number;
};

// 失敗したときの次の手: トークンを取り直して送り直す／待ってから送り直す／そのまま投げる／
// 書き込みが適用されたか分からないことを添えて投げる。
export type Recovery = "refresh" | "backoff" | "throw" | "unknownOutcome";

// 判断だけを純粋な関数にして、送信のループから分けている（requester.test.ts が直接確かめる）。
export const recoveryFor = (e: PortersError, s: AttemptState): Recovery => {
  // reactive: token expired -> refresh once and retry (safe even for create). Only the
  // Resource API's 401 / 402 mean "Access Token expired": the Authentication API numbers its
  // codes separately (its 401 is "Refresh Token expired", raised while fetching the token), and
  // forcing another refresh on that only repeats the request that just failed.
  if (
    e instanceof PortersResourceError &&
    (e.code === 401 || e.code === 402) &&
    !s.authRetried
  )
    return "refresh";
  // idempotency guard (ADR-0010 / ADR-0063): stop a non-idempotent write only when it was
  // sent *and* the outcome is unknown. Two failures are known not to have applied:
  //   - `sent === false` — the request never left (token fetch / pre-send failure).
  //   - `rateLimit` — HTTP 429 means it was refused before being processed.
  // VERIFY(live): that a 429 is always a pre-processing refusal is unconfirmed — PORTERS is
  // expected to drop the connection instead, so 429 comes from an intermediary. See
  // docs/live-verification.md (LV-9).
  const mayHaveApplied = s.sent && e.category !== "rateLimit";
  if (mayHaveApplied && s.write && !s.idempotent) {
    // 通信の失敗は、書き込みが適用されたか分からない（ADR-0010）。
    if (e instanceof PortersNetworkError) return "unknownOutcome";
    // PORTERS が状態を返した一時的な失敗のうち、再送してよいのは未処理が確定する Code 9 だけ。
    // 302（トランザクションエラー / 対象削除済み）は、登録まで進んだかが分からない（ADR-0103）。
    if (e.retryable && e.code !== 9) return "unknownOutcome";
  }
  // transient (9/302) / network -> bounded backoff.
  if (e.retryable && s.attempt < s.maxRetries) return "backoff";
  return "throw";
};

const UNKNOWN_OUTCOME_HINT =
  "The write may have been applied before this failure. It is not safe to resend as is: check whether the record was created, then retry only if it was not.";

// 送信済みの非冪等な書き込みが失敗したときのエラー。`retryable` は「利用者がそのまま再送してよいか」を
// 表すので false にし、元のエラーは `cause` に残す（ADR-0010 / ADR-0103）。ここに来るのは通信の失敗
// （PortersNetworkError）か、PORTERS が返した一時的な失敗（PortersResourceError）だけ。
export const asUnknownOutcome = (e: PortersError): PortersError => {
  const options = {
    category: e.category,
    code: e.code,
    retryable: false,
    hint: UNKNOWN_OUTCOME_HINT,
    httpStatus: e.httpStatus,
    context: e.context,
    cause: e,
  };
  return e instanceof PortersResourceError
    ? new PortersResourceError(e.message, options)
    : new PortersNetworkError(e.message, options);
};

export const createRequester = (o: RequesterOptions): Requester => {
  const maxRetries = o.maxRetries ?? 3;

  const request = async <T>(
    req: TransportRequest,
    parse: (body: string) => T,
    spec: RequestSpec = {},
  ): Promise<T> => {
    assertRequestLength(req, spec);
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
        const next = recoveryFor(e, {
          sent,
          authRetried,
          write,
          idempotent,
          attempt,
          maxRetries,
        });
        if (next === "refresh") {
          authRetried = true;
          forceRefresh = true;
          continue;
        }
        if (next === "backoff") {
          attempt += 1;
          await sleep(o.backoff(attempt - 1));
          continue;
        }
        if (next === "unknownOutcome") throw asUnknownOutcome(e);
        throw e;
      }
    }
  };

  return { request };
};
