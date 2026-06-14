import { describe, expect, it } from "vitest";

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
});
