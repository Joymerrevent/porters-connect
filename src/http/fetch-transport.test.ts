import { describe, expect, it, vi } from "vitest";

import { PortersNetworkError } from "../errors/index";
import { createFetchTransport } from "./fetch-transport";

describe("createFetchTransport (ADR-0009)", () => {
  it("returns status + text body from the injected fetch", async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        new Response("<xml/>", { status: 200 }),
      )) as unknown as typeof fetch;
    const transport = createFetchTransport({ fetchImpl });

    const res = await transport.send({ method: "GET", url: "u", headers: {} });
    expect(res.status).toBe(200);
    expect(res.body).toBe("<xml/>");
  });

  it("wraps network failures in PortersNetworkError (network, retryable)", async () => {
    const cause = new Error("ECONNRESET");
    const fetchImpl = (() => Promise.reject(cause)) as unknown as typeof fetch;
    const transport = createFetchTransport({ fetchImpl });

    let err: unknown;
    try {
      await transport.send({ method: "GET", url: "u", headers: {} });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersNetworkError);
    const e = err as PortersNetworkError;
    expect(e.category).toBe("network");
    expect(e.retryable).toBe(true);
    expect(e.message).toBe("transport request failed");
    expect(e.cause).toBe(cause);
  });

  it("uses global fetch with the request's method / headers / body", async () => {
    const spy = vi.fn(() =>
      Promise.resolve(new Response("ok", { status: 200 })),
    );
    vi.stubGlobal("fetch", spy);
    const res = await createFetchTransport().send({
      method: "POST",
      url: "https://h/u",
      headers: { "X-A": "1" },
      body: "B",
    });
    expect(res.body).toBe("ok");
    expect(spy).toHaveBeenCalledWith(
      "https://h/u",
      expect.objectContaining({
        method: "POST",
        headers: { "X-A": "1" },
        body: "B",
      }),
    );
    vi.unstubAllGlobals();
  });
});
