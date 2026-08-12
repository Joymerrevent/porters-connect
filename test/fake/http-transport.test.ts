import { describe, expect, it, vi } from "vitest";

import { createForwardingTransport } from "./http-transport";

const capture = () => {
  const calls: { url: string; init: RequestInit }[] = [];
  // The library always calls fetch with a string URL (see fetch-transport).
  const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} });
    return Promise.resolve(
      new Response("<Candidate><Code>0</Code></Candidate>"),
    );
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
};

describe("forwarding transport", () => {
  it("swaps scheme and authority, keeping path and query verbatim", async () => {
    const { calls, fetchImpl } = capture();
    const transport = createForwardingTransport({
      baseUrl: "http://127.0.0.1:4010",
      fetchImpl,
    });

    await transport.send({
      method: "GET",
      url: "https://tenant.porters.example/v1/candidate?partition=1&field=Person.P_Id%2CPerson.P_Name",
      headers: {},
    });

    expect(calls[0]?.url).toBe(
      "http://127.0.0.1:4010/v1/candidate?partition=1&field=Person.P_Id%2CPerson.P_Name",
    );
  });

  it("passes method, headers and body through untouched", async () => {
    const { calls, fetchImpl } = capture();
    const transport = createForwardingTransport({
      baseUrl: "http://localhost:5000",
      fetchImpl,
    });

    await transport.send({
      method: "POST",
      url: "https://tenant.porters.example/v1/candidate?partition=1",
      headers: { "X-porters-hrbc-oauth-token": "token-1" },
      body: "<Candidate><Item /></Candidate>",
    });

    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toEqual({
      "X-porters-hrbc-oauth-token": "token-1",
    });
    expect(calls[0]?.init.body).toBe("<Candidate><Item /></Candidate>");
  });

  it("surfaces a transport failure as a retryable PortersNetworkError", async () => {
    const transport = createForwardingTransport({
      baseUrl: "http://127.0.0.1:4010",
      fetchImpl: () => Promise.reject(new Error("ECONNREFUSED")),
    });

    // Same mapping as the default transport — nothing here changes the error contract.
    await expect(
      transport.send({
        method: "GET",
        url: "https://tenant.porters.example/v1/candidate",
        headers: {},
      }),
    ).rejects.toMatchObject({
      name: "PortersNetworkError",
      category: "network",
      retryable: true,
    });
  });
});
