import { describe, expect, it, vi } from "vitest";

import type { TokenProvider } from "../auth/types";
import {
  PortersConfigError,
  PortersNetworkError,
  PortersResourceError,
} from "../errors/index";
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

const post = {
  method: "POST",
  url: "u",
  headers: {},
} satisfies TransportRequest;

const transientErr = (): PortersResourceError =>
  new PortersResourceError("temp", {
    category: "transient",
    code: 9,
    retryable: true,
  });
const networkErr = (): PortersNetworkError =>
  new PortersNetworkError("timeout", { category: "network", retryable: true });
const authErr = (code: number): PortersResourceError =>
  new PortersResourceError("expired", { category: "auth", code });

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

  it("adds the write Content-Type header but not on reads", async () => {
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

    await r.request(post, (b) => b, { write: true });
    await r.request(base, (b) => b); // read

    expect(sent[0]?.headers["Content-Type"]).toBe(
      "application/xml; charset=UTF-8",
    );
    expect(sent[1]?.headers["Content-Type"]).toBeUndefined(); // write defaults to false
  });

  it("forces a refresh only for the 401 retry — not initially, not on later retries", async () => {
    const calls: { force: boolean }[] = [];
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b === "0") throw authErr(401);
      if (b === "1") throw transientErr();
      return "RESULT";
    };
    const r = createRequester({
      transport,
      auth: mockAuth(calls),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(await r.request(base, parse)).toBe("RESULT");
    // initial=false, 401-retry=true, transient-retry back to false
    expect(calls.map((c) => c.force)).toEqual([false, true, false]);
  });

  it("refreshes on 402 as well as 401", async () => {
    const calls: { force: boolean }[] = [];
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b === "0") throw authErr(402);
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

  it("refreshes at most once for repeated 401s (no infinite refresh)", async () => {
    const calls: { force: boolean }[] = [];
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.resolve({ status: 200, body: "x" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth(calls),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    await expect(
      r.request(base, () => {
        throw authErr(401);
      }),
    ).rejects.toBeInstanceOf(PortersResourceError);
    expect(n).toBe(2); // initial + one refresh retry, then give up
    expect(calls.filter((c) => c.force).length).toBe(1);
  });

  it("retries an idempotent GET on a network error", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.reject(networkErr());
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
      maxRetries: 2,
    });

    await expect(r.request(base, (b) => b)).rejects.toBeInstanceOf(
      PortersNetworkError,
    );
    expect(n).toBe(3); // GET is idempotent -> initial + 2 retries
  });

  it("does not retry a default create (no idempotent flag) on a network error", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.reject(networkErr());
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    await expect(
      r.request(post, (b) => b, { write: true }),
    ).rejects.toBeInstanceOf(PortersNetworkError);
    expect(n).toBe(1); // write defaults to non-idempotent
  });

  it("retries an explicitly idempotent write on a network error", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return n < 2
          ? Promise.reject(networkErr())
          : Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(
      await r.request(post, (b) => b, { write: true, idempotent: true }),
    ).toBe("ok");
    expect(n).toBe(2); // idempotent -> retried once, then succeeded
  });

  it("retries a create on a transient (non-network) error", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b !== "1") throw transientErr();
      return "OK";
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    // the network-uncertainty guard is network-only; transient writes still retry
    expect(
      await r.request(post, parse, { write: true, idempotent: false }),
    ).toBe("OK");
    expect(n).toBe(2);
  });

  it("rethrows a non-PortersError immediately, even if it looks retryable", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.resolve({ status: 200, body: "x" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });
    const weird = Object.assign(new Error("weird"), {
      retryable: true,
      code: 9,
    });

    await expect(
      r.request(base, () => {
        throw weird;
      }),
    ).rejects.toBe(weird);
    expect(n).toBe(1); // not a PortersError -> never retried
  });

  it("rejects an oversized body before reaching the transport", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    let err: unknown;
    try {
      await r.request(
        { method: "POST", url: "u", headers: {}, body: "x".repeat(15001) },
        (b) => b,
        { write: true },
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).category).toBe("config");
    expect((err as PortersConfigError).message).toContain("15001");
    expect((err as PortersConfigError).message).toContain("15000");
    expect((err as PortersConfigError).hint).toContain("smaller batches");
    expect(n).toBe(0); // never sent — guarded before transport
  });

  it("allows a body exactly at the limit through to the transport", async () => {
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

    const body = "x".repeat(15000); // == limit is allowed; only > limit is blocked
    expect(
      await r.request(
        { method: "POST", url: "u", headers: {}, body },
        (b) => b,
        {
          write: true,
        },
      ),
    ).toBe("ok");
    expect(sent).toHaveLength(1);
  });

  it("skips the size guard when unboundedBody is set (file uploads)", async () => {
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

    // a body well over the 15000-char limit goes through when unboundedBody is true
    const body = "x".repeat(20000);
    expect(
      await r.request(
        { method: "POST", url: "u", headers: {}, body },
        (b) => b,
        {
          write: true,
          unboundedBody: true,
        },
      ),
    ).toBe("ok");
    expect(sent).toHaveLength(1);
  });

  it("waits backoff(attempt-1) between transient retries", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const backoffArgs: number[] = [];
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b !== "2") throw transientErr();
      return "OK";
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: (a) => {
        backoffArgs.push(a);
        return 7;
      },
    });

    const p = r.request(base, parse);
    await vi.runAllTimersAsync();
    expect(await p).toBe("OK");
    expect(backoffArgs[0]).toBe(0); // first retry: attempt(1) - 1 = 0
    expect(setTimeoutSpy.mock.calls.map((c) => Number(c[1]))).toContain(7);

    setTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });
});
