import { describe, expect, it, vi } from "vitest";

import {
  PortersConfigError,
  PortersNetworkError,
} from "../../src/errors/index";
import type { TransportRequest } from "../../src/http/types";
import { createFakeTransport } from "./fake-transport";

const request = (method: "GET" | "POST", path: string): TransportRequest => ({
  method,
  url: `https://fake.test${path}?partition=1`,
  headers: {},
});

describe("fake transport routing (phase 0 skeleton)", () => {
  it("fails loud on a path the fake does not route", async () => {
    const fake = createFakeTransport();

    await expect(fake.send(request("GET", "/v1/unheard-of"))).rejects.toThrow(
      PortersConfigError,
    );
    await expect(
      fake.send(request("GET", "/v1/unheard-of")),
    ).rejects.toMatchObject({
      message: "fake server: no route for GET /v1/unheard-of",
      category: "config",
    });
  });

  it("routes the auth endpoints and says which phase implements them", async () => {
    const fake = createFakeTransport();

    for (const path of ["/v1/oauth", "/v1/token"]) {
      await expect(fake.send(request("GET", path))).rejects.toMatchObject({
        message: `fake server: the auth endpoint ${path} is not implemented yet`,
        category: "config",
      });
    }
  });

  it("routes a known resource by its own descriptor path", async () => {
    const fake = createFakeTransport();

    await expect(
      fake.send(request("POST", "/v1/candidate")),
    ).rejects.toMatchObject({
      message: "fake server: POST /v1/candidate is not implemented yet",
      category: "config",
    });
  });

  it("rejects an option whose behaviour has not landed yet", () => {
    expect(() =>
      createFakeTransport({ rateLimit: { readPerMinute: 1 } }),
    ).toThrow(/option\(s\) rateLimit are declared but not wired yet/);
    expect(() => createFakeTransport({ latencyMs: 0 })).not.toThrow();
  });
});

describe("fake transport fault injection", () => {
  it("fails like a dropped connection, retryably", async () => {
    const fake = createFakeTransport();
    fake.control.failNext({ kind: "network" });

    const failure = fake.send(request("GET", "/v1/candidate"));

    await expect(failure).rejects.toThrow(PortersNetworkError);
    await expect(failure).rejects.toMatchObject({
      category: "network",
      retryable: true,
    });
  });

  it("answers a raw HTTP status without a PORTERS envelope", async () => {
    const fake = createFakeTransport();
    fake.control.failNext({ kind: "http", status: 429, body: "slow down" });

    await expect(fake.send(request("GET", "/v1/candidate"))).resolves.toEqual({
      status: 429,
      body: "slow down",
    });
  });

  it("queues one fault per request and stops injecting once drained", async () => {
    const fake = createFakeTransport();
    fake.control.failNext({ kind: "http", status: 503 }, 2);
    expect(fake.control.pendingFaults()).toHaveLength(2);

    await expect(fake.send(request("GET", "/v1/candidate"))).resolves.toEqual({
      status: 503,
      body: "",
    });
    await expect(fake.send(request("GET", "/v1/candidate"))).resolves.toEqual({
      status: 503,
      body: "",
    });
    expect(fake.control.pendingFaults()).toHaveLength(0);
    // Drained: the request reaches the (not yet implemented) handler again.
    await expect(fake.send(request("GET", "/v1/candidate"))).rejects.toThrow(
      PortersConfigError,
    );
  });

  it("refuses a fault kind it cannot apply yet, instead of ignoring it", () => {
    const fake = createFakeTransport();

    expect(() =>
      fake.control.failNext({ kind: "resultCode", code: 403 }),
    ).toThrow(/fault kind "resultCode" is not implemented yet/);
    expect(fake.control.pendingFaults()).toHaveLength(0);
  });

  it("clearFaults() and reset() drop what is queued", async () => {
    const fake = createFakeTransport();
    fake.control.failNext({ kind: "network" });
    fake.control.clearFaults();
    expect(fake.control.pendingFaults()).toHaveLength(0);

    fake.control.failNext({ kind: "network" });
    fake.control.reset();
    expect(fake.control.pendingFaults()).toHaveLength(0);
    await expect(fake.send(request("GET", "/v1/candidate"))).rejects.toThrow(
      PortersConfigError,
    );
  });
});

describe("fake transport latency", () => {
  it("waits the configured latency before answering", async () => {
    vi.useFakeTimers();
    try {
      const fake = createFakeTransport({ latencyMs: 50 });
      let settled = false;
      const pending = fake
        .send(request("GET", "/v1/candidate"))
        .catch(() => undefined)
        .finally(() => {
          settled = true;
        });

      await vi.advanceTimersByTimeAsync(49);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("setLatency() replaces it at runtime", async () => {
    const fake = createFakeTransport({ latencyMs: 10_000 });
    fake.control.setLatency(0);

    // Would time out if the 10s latency were still in force.
    await expect(fake.send(request("GET", "/v1/candidate"))).rejects.toThrow(
      PortersConfigError,
    );
  });
});

describe("fake transport state", () => {
  it("exposes the record store for assertions and clears it on reset", () => {
    const fake = createFakeTransport();
    expect(fake.control.records("candidate")).toEqual([]);

    fake.control.records("candidate").push({ P_Id: "10001" });
    expect(fake.control.records("candidate")).toHaveLength(1);

    fake.control.reset();
    expect(fake.control.records("candidate")).toEqual([]);
  });
});
