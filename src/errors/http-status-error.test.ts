import { describe, expect, it } from "vitest";

import {
  PortersAuthError,
  PortersConfigError,
  PortersError,
  PortersNetworkError,
  PortersResourceError,
} from "./porters-error";
import {
  httpStatusCategory,
  httpStatusError,
  withHttpStatus,
} from "./http-status-error";
import { resourceError } from "./resource-error";

describe("HTTP status classification (ADR-0044)", () => {
  it("maps statuses to categories", () => {
    expect(httpStatusCategory(500)).toBe("server"); // 5xx floor
    expect(httpStatusCategory(502)).toBe("server");
    expect(httpStatusCategory(429)).toBe("rateLimit");
    expect(httpStatusCategory(408)).toBe("network");
    expect(httpStatusCategory(401)).toBe("permission");
    expect(httpStatusCategory(403)).toBe("permission");
    expect(httpStatusCategory(400)).toBe("config"); // 4xx floor, not one of the above
    expect(httpStatusCategory(404)).toBe("config");
    expect(httpStatusCategory(499)).toBe("config"); // still below the 5xx floor
    expect(httpStatusCategory(302)).toBe("unknown"); // below the 4xx floor
  });

  it("never carries a PORTERS code, always the status, and only retries the transport-path ones", () => {
    const server = httpStatusError(503);
    expect(server).toBeInstanceOf(PortersNetworkError);
    expect(server.category).toBe("server");
    expect(server.code).toBeNull(); // not a PORTERS code — there was no envelope
    expect(server.httpStatus).toBe(503);
    expect(server.retryable).toBe(true);
    expect(server.message).toContain("503");
    expect(server.hint).toContain("load balancer");

    const rate = httpStatusError(429);
    expect(rate).toBeInstanceOf(PortersNetworkError);
    expect(rate.retryable).toBe(true);
    expect(rate.hint).toContain("Too many requests");

    const timeout = httpStatusError(408);
    expect(timeout).toBeInstanceOf(PortersNetworkError);
    expect(timeout.retryable).toBe(true);
    expect(timeout.hint).toContain("timed out");
  });

  it("splits the 4xx range by who rejected the request", () => {
    const denied = httpStatusError(403);
    expect(denied).toBeInstanceOf(PortersAuthError);
    expect(denied.category).toBe("permission");
    expect(denied.retryable).toBe(false); // a permission problem does not improve on retry
    expect(denied.hint).toContain("scopes");

    const misdirected = httpStatusError(404);
    expect(misdirected).toBeInstanceOf(PortersConfigError);
    expect(misdirected.category).toBe("config");
    expect(misdirected.retryable).toBe(false);
    expect(misdirected.hint).toContain("host");
  });

  it("falls back to the base class for a status it cannot place (fail-safe)", () => {
    const odd = httpStatusError(302);
    expect(odd).toBeInstanceOf(PortersError);
    expect(odd).not.toBeInstanceOf(PortersNetworkError);
    expect(odd.category).toBe("unknown");
    expect(odd.retryable).toBe(false);
    expect(odd.hint).toContain("httpStatus");
  });

  it("keeps what reading the body produced as the cause", () => {
    const cause = new PortersResourceError("unparseable resource response", {
      category: "unknown",
    });
    expect(httpStatusError(503, cause).cause).toBe(cause);
    expect(httpStatusError(503).cause).toBeUndefined();
  });

  it("stamps the status onto an error the parser already built", () => {
    const e = resourceError(403, "no perm");
    expect(e.httpStatus).toBeUndefined();

    expect(withHttpStatus(e, 200)).toBe(e); // same instance — nothing else is disturbed
    expect(e.httpStatus).toBe(200);
    expect(e.code).toBe(403);
    expect(e.category).toBe("permission");
  });
});
