import { describe, expect, it } from "vitest";

import type { TokenProvider } from "../auth/types";
import { PortersNetworkError, PortersResourceError } from "../errors/index";
import { createRequester } from "./requester";
import type { Throttle } from "./throttle";
import type { Transport, TransportRequest } from "./types";

const noThrottle: Throttle = { take: () => Promise.resolve() };
const noBackoff = (): number => 0;

const mockAuth = (calls: { force: boolean }[]): TokenProvider => ({
  getAccessToken: (o) => {
    calls.push({ force: o?.forceRefresh ?? false });
    return Promise.resolve("TKN");
  },
});

const base = {
  method: "GET",
  url: "u",
  headers: {},
} satisfies TransportRequest;

describe("createRequester (ADR-0009/0010/0012)", () => {
  it("injects auth + version headers and returns the parsed value", async () => {
    const sent: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        sent.push(req);
        return Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(await r.request(base, (b) => b.toUpperCase())).toBe("OK");
    expect(sent[0]?.headers["X-porters-hrbc-oauth-token"]).toBe("TKN");
    expect(sent[0]?.headers["X-P-ConnectAPI-Version"]).toBe("2");
  });

  it("refreshes and retries once on 401", async () => {
    const calls: { force: boolean }[] = [];
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b === "0") {
        throw new PortersResourceError("expired", {
          category: "auth",
          code: 401,
        });
      }
      return "RESULT";
    };
    const r = createRequester({
      transport,
      auth: mockAuth(calls),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(await r.request(base, parse)).toBe("RESULT");
    expect(calls.some((c) => c.force)).toBe(true);
  });

  it("retries transient errors with bounded backoff", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b !== "2") {
        throw new PortersResourceError("temp", {
          category: "transient",
          code: 9,
          retryable: true,
        });
      }
      return "OK";
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(await r.request(base, parse)).toBe("OK");
    expect(n).toBe(3); // failed twice, then succeeded
  });

  it("does not retry create (non-idempotent write) on network uncertainty", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.reject(
          new PortersNetworkError("timeout", {
            category: "network",
            retryable: true,
          }),
        );
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    await expect(
      r.request({ method: "POST", url: "u", headers: {} }, (b) => b, {
        write: true,
        idempotent: false,
      }),
    ).rejects.toBeInstanceOf(PortersNetworkError);
    expect(n).toBe(1); // sent once, not retried
  });

  it("gives up after maxRetries on persistent transient errors", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (): string => {
      throw new PortersResourceError("temp", {
        category: "transient",
        code: 9,
        retryable: true,
      });
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
      maxRetries: 2,
    });

    await expect(r.request(base, parse)).rejects.toBeInstanceOf(
      PortersResourceError,
    );
    expect(n).toBe(3); // initial + 2 retries
  });

  it("rethrows a non-PortersError thrown by parse", async () => {
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: "x" }),
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    await expect(
      r.request(base, () => {
        throw new TypeError("boom");
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
