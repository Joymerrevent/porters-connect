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

  it("wraps network failures in PortersNetworkError (retryable)", async () => {
    const fetchImpl = (() =>
      Promise.reject(new Error("ECONNRESET"))) as unknown as typeof fetch;
    const transport = createFetchTransport({ fetchImpl });

    await expect(
      transport.send({ method: "GET", url: "u", headers: {} }),
    ).rejects.toBeInstanceOf(PortersNetworkError);
  });

  it("uses global fetch when no fetchImpl is given", async () => {
    const spy = vi.fn(() =>
      Promise.resolve(new Response("ok", { status: 200 })),
    );
    vi.stubGlobal("fetch", spy);
    const res = await createFetchTransport().send({
      method: "GET",
      url: "u",
      headers: {},
    });
    expect(res.body).toBe("ok");
    expect(spy).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
