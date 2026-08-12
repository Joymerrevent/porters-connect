// How a response is read (ADR-0044 / ADR-0050). These are the rules themselves, driven directly:
// which of the two error channels wins, when a status is allowed to override a parsed body, and
// what always carries `httpStatus`. The pipeline-level consequences (retry, the idempotency guard)
// belong to `requester.test.ts`; the auth-path wiring to `auth/token-provider.test.ts`.

import { describe, expect, it } from "vitest";

import {
  PortersError,
  PortersResourceError,
  resourceError,
} from "../errors/index";
import { readResponse } from "./read-response";

// The two shapes a parser can fail with: a PORTERS code (the API answered) and no code at all
// (the body was not an envelope) — the distinction the whole decision turns on.
const withCode = (): PortersResourceError => resourceError(403, "no perm");
const unparseable = (): PortersResourceError =>
  new PortersResourceError("unparseable resource response", {
    category: "unknown",
  });

const parsedOk = (body: string): string => `parsed:${body}`;
const throwing = (e: unknown) => (): never => {
  throw e;
};

describe("readResponse — success", () => {
  it("returns the parsed value on 200", () => {
    expect(readResponse({ status: 200, body: "xml" }, parsedOk)).toBe(
      "parsed:xml",
    );
  });

  it("treats the whole 2xx range as success, and nothing outside it", () => {
    for (const status of [200, 204, 299]) {
      expect(readResponse({ status, body: "xml" }, parsedOk), `${status}`).toBe(
        "parsed:xml",
      );
    }
    // A parseable body does not make a non-2xx a success — this is the case that would otherwise
    // hand a proxy's HTML page back as "no results" (fail-safe).
    for (const status of [199, 300, 404, 500]) {
      expect(
        () => readResponse({ status, body: "xml" }, parsedOk),
        `${status}`,
      ).toThrow(expect.objectContaining({ httpStatus: status }));
    }
  });
});

describe("readResponse — the envelope wins when it has a PORTERS code", () => {
  it("keeps the error and stamps the status (200)", () => {
    let err: unknown;
    try {
      readResponse({ status: 200, body: "envelope" }, throwing(withCode()));
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: 403, category: "permission" });
    expect((err as PortersError).httpStatus).toBe(200);
  });

  it("keeps the error and stamps the status (non-2xx)", () => {
    // Both channels answer. The `<Code>` is the more specific one, so the status is only added.
    let err: unknown;
    try {
      readResponse({ status: 400, body: "envelope" }, throwing(withCode()));
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: 403, category: "permission" });
    expect((err as PortersError).httpStatus).toBe(400);
  });
});

describe("readResponse — no envelope", () => {
  it("keeps the parse failure on a 2xx, because the status adds nothing", () => {
    let err: unknown;
    try {
      readResponse({ status: 200, body: "not xml" }, throwing(unparseable()));
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ category: "unknown", code: null });
    expect((err as PortersError).httpStatus).toBe(200);
  });

  it("classifies from the status on a non-2xx, keeping the parse failure as the cause", () => {
    // The load-balancer case: "unparseable" says nothing about whether to retry; 503 does.
    const cause = unparseable();
    let err: unknown;
    try {
      readResponse({ status: 503, body: "<html>" }, throwing(cause));
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({
      name: "PortersNetworkError",
      category: "server",
      code: null,
      retryable: true,
      httpStatus: 503,
      cause,
    });
  });

  it("classifies from the status when parse throws something foreign", () => {
    const boom = new TypeError("boom");
    let err: unknown;
    try {
      readResponse({ status: 404, body: "nope" }, throwing(boom));
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({
      name: "PortersConfigError",
      category: "config",
      httpStatus: 404,
      cause: boom,
    });
  });

  it("lets a foreign failure through untouched on a 2xx", () => {
    // Not ours and nothing to add: a caller's own bug must not be relabelled as a PORTERS error.
    const boom = new TypeError("boom");
    expect(() =>
      readResponse({ status: 200, body: "x" }, throwing(boom)),
    ).toThrow(boom);
  });
});
