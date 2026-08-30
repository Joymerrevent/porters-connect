import { describe, expect, it, vi } from "vitest";

import { PortersError, PortersNetworkError } from "../../src/errors/index";
import type { TransportRequest } from "../../src/http/types";
import {
  parseAuthentication,
  parseResourcePage,
  parseWriteResult,
} from "../../src/xml/parser";
import { createFakeTransport } from "./fake-transport";
import type { FakeTransport } from "./types";

const url = (path: string, query = "partition=1"): string =>
  `https://fake.test${path}${query === "" ? "" : `?${query}`}`;

const authenticate = async (fake: FakeTransport): Promise<string> => {
  const granted = await fake.send({
    method: "GET",
    url: url("/v1/oauth", "app_id=app&response_type=code_direct"),
    headers: {},
  });
  const { code } = parseAuthentication(granted.body);
  const issued = await fake.send({
    method: "POST",
    url: url("/v1/token", ""),
    headers: {},
    body: new URLSearchParams({
      app_id: "app",
      secret: "secret",
      grant_type: "oauth_code",
      code: code ?? "",
    }).toString(),
  });
  return parseAuthentication(issued.body).accessToken ?? "";
};

const read = (token: string, query = "partition=1"): TransportRequest => ({
  method: "GET",
  url: url("/v1/candidate", query),
  headers: {
    "X-porters-hrbc-oauth-token": token,
    "X-P-ConnectAPI-Version": "2",
  },
});

const write = (token: string, body: string): TransportRequest => ({
  method: "POST",
  url: url("/v1/candidate"),
  headers: {
    "X-porters-hrbc-oauth-token": token,
    "X-P-ConnectAPI-Version": "2",
  },
  body,
});

// The Result Code the library would see, read through the library's own parser. Everything here
// is on the Candidate path, so that is also the root the Read parser is told to expect (ADR-0051).
const resultCode = (body: string): number => {
  try {
    parseResourcePage(body, "Candidate");
    return 0;
  } catch (error) {
    return error instanceof PortersError ? (error.code ?? -1) : -1;
  }
};

// A Write answer is read by the Write parser: its success shape has no root `<Code>` at all
// (write-format.md), only a per-Item one. A request-level failure does put `<Code>` at the root,
// which parseWriteResult reads first (ADR-0045).
const writeResultCode = (body: string): number => {
  try {
    return parseWriteResult(body)[0]?.code ?? -1;
  } catch (error) {
    return error instanceof PortersError ? (error.code ?? -1) : -1;
  }
};

describe("fake transport routing", () => {
  it("fails loud on a path the fake does not route", async () => {
    const fake = createFakeTransport();

    await expect(
      fake.send({ method: "GET", url: url("/v1/unheard-of"), headers: {} }),
    ).rejects.toMatchObject({
      name: "PortersConfigError",
      message: "fake server: no route for GET /v1/unheard-of",
    });
  });

  it("refuses to seed a resource it cannot serve", () => {
    expect(() =>
      createFakeTransport({ seed: { contact: [{ P_Name: "x" }] } }),
    ).toThrow(/cannot seed unknown resource "contact"/);
  });
});

describe("fake transport access guards", () => {
  it("answers 402 without a token and 401 once it has expired", async () => {
    const fake = createFakeTransport();
    const token = await authenticate(fake);

    const anonymous = await fake.send({
      ...read(token),
      headers: { "X-P-ConnectAPI-Version": "2" },
    });
    expect(resultCode(anonymous.body)).toBe(402);

    expect(resultCode((await fake.send(read(token))).body)).toBe(0);

    fake.control.expireAccessTokens();
    expect(resultCode((await fake.send(read(token))).body)).toBe(401);
  });

  it("rejects an unsupported Connect API version with 146", async () => {
    const fake = createFakeTransport();
    const token = await authenticate(fake);

    const answer = await fake.send({
      ...read(token),
      headers: {
        "X-porters-hrbc-oauth-token": token,
        "X-P-ConnectAPI-Version": "3",
      },
    });
    expect(resultCode(answer.body)).toBe(146);
  });

  it("rejects an unknown partition with 404", async () => {
    const fake = createFakeTransport({ partitions: [7] });
    const token = await authenticate(fake);

    expect(resultCode((await fake.send(read(token))).body)).toBe(404);
    expect(resultCode((await fake.send(read(token, "partition=7"))).body)).toBe(
      0,
    );
  });

  it("rejects an over-long request with a bare HTTP 400", async () => {
    const fake = createFakeTransport();
    const token = await authenticate(fake);
    const huge = `partition=1&condition=${"x".repeat(15_000)}`;

    const answer = await fake.send(read(token, huge));

    expect(answer.status).toBe(400);
    expect(answer.body).toBe("request too long");
  });
});

describe("fake transport write guards", () => {
  it("rejects a body that is not a Write envelope with 100", async () => {
    const fake = createFakeTransport();
    const token = await authenticate(fake);

    const wrongRoot = await fake.send(
      write(token, "<Job><Item><Job.P_Id>-1</Job.P_Id></Item></Job>"),
    );
    expect(resultCode(wrongRoot.body)).toBe(100);
  });

  it("rejects more than 200 records with 102", async () => {
    const fake = createFakeTransport();
    const token = await authenticate(fake);
    const item = "<Item><Person.P_Id>-1</Person.P_Id></Item>";

    const answer = await fake.send(
      write(token, `<Candidate>${item.repeat(201)}</Candidate>`),
    );

    expect(resultCode(answer.body)).toBe(102);
    expect(fake.control.records("candidate")).toHaveLength(0);
  });
});

describe("fake transport rate limits", () => {
  it("closes the connection when a per-minute cap is exceeded", async () => {
    const fake = createFakeTransport({ rateLimit: { readPerMinute: 1 } });
    const token = await authenticate(fake);

    expect(resultCode((await fake.send(read(token))).body)).toBe(0);

    const failure = fake.send(read(token));
    await expect(failure).rejects.toThrow(PortersNetworkError);
    // Retryable: the reference says the connection *may* be closed, not that the call is doomed.
    await expect(failure).rejects.toMatchObject({
      category: "network",
      retryable: true,
    });
  });

  it("can answer HTTP 429 instead, for the other reading of the limit", async () => {
    const fake = createFakeTransport({
      rateLimit: { readPerMinute: 1, mode: "http429" },
    });
    const token = await authenticate(fake);
    await fake.send(read(token));

    expect((await fake.send(read(token))).status).toBe(429);
  });

  it("counts Read and Write separately", async () => {
    const fake = createFakeTransport({
      rateLimit: { readPerMinute: 1, writePerMinute: 1 },
    });
    const token = await authenticate(fake);
    await fake.send(read(token));

    // The read cap is used up, but the write bucket is still open.
    const body =
      "<Candidate><Item><Person.P_Id>-1</Person.P_Id></Item></Candidate>";
    expect(writeResultCode((await fake.send(write(token, body))).body)).toBe(0);
    await expect(fake.send(read(token))).rejects.toThrow(PortersNetworkError);
  });

  it("rejects before authentication is even considered", async () => {
    const fake = createFakeTransport({ rateLimit: { readPerMinute: 0 } });

    // No token at all: the limiter answers first, exactly as an edge would.
    await expect(fake.send(read("no-such-token"))).rejects.toThrow(
      PortersNetworkError,
    );
  });

  it("does not count the Authentication API", async () => {
    const fake = createFakeTransport({ rateLimit: { readPerMinute: 1 } });

    // The OAuth + Token round-trip is two requests; the read after it still fits the cap of 1.
    const token = await authenticate(fake);

    expect(resultCode((await fake.send(read(token))).body)).toBe(0);
  });
});

describe("fake transport fault injection", () => {
  it("fails like a dropped connection, retryably", async () => {
    const fake = createFakeTransport();
    fake.control.failNext({ kind: "network" });

    const failure = fake.send({
      method: "GET",
      url: url("/v1/candidate"),
      headers: {},
    });

    await expect(failure).rejects.toThrow(PortersNetworkError);
    await expect(failure).rejects.toMatchObject({
      category: "network",
      retryable: true,
    });
  });

  it("answers a raw HTTP status without a PORTERS envelope", async () => {
    const fake = createFakeTransport();
    fake.control.failNext({ kind: "http", status: 429, body: "slow down" });

    await expect(
      fake.send({ method: "GET", url: url("/v1/candidate"), headers: {} }),
    ).resolves.toEqual({ status: 429, body: "slow down" });
  });

  it("holds a Result Code fault for the resource call, not the OAuth round-trip", async () => {
    const fake = createFakeTransport();
    fake.control.failNext({ kind: "resultCode", code: 403 });

    // Authenticating must not consume it — that is the whole point of targeting.
    const token = await authenticate(fake);
    expect(fake.control.pendingFaults()).toHaveLength(1);

    expect(resultCode((await fake.send(read(token))).body)).toBe(403);
    expect(fake.control.pendingFaults()).toHaveLength(0);
    expect(resultCode((await fake.send(read(token))).body)).toBe(0);
  });

  it("holds an auth fault for the Authentication API", async () => {
    const fake = createFakeTransport();
    fake.control.failNext({ kind: "authError", error: 105 });

    const granted = await fake.send({
      method: "GET",
      url: url("/v1/oauth", "app_id=app&response_type=code_direct"),
      headers: {},
    });

    expect(() => parseAuthentication(granted.body)).toThrow(
      expect.objectContaining({ name: "PortersAuthError", code: 105 }),
    );
  });

  it("applies per-item write codes only to a write", async () => {
    const fake = createFakeTransport();
    const token = await authenticate(fake);
    fake.control.failNext({ kind: "writeItemCodes", codes: [0, 133] });

    // A read leaves it queued...
    await fake.send(read(token));
    expect(fake.control.pendingFaults()).toHaveLength(1);

    const item = (id: string): string =>
      `<Item><Person.P_Id>${id}</Person.P_Id><Person.P_Owner>5</Person.P_Owner></Item>`;
    const answer = await fake.send(
      write(token, `<Candidate>${item("-1")}${item("-1")}</Candidate>`),
    );

    expect(answer.body).toContain("<Code>133</Code>");
    // The failed record was not written.
    expect(fake.control.records("candidate")).toHaveLength(1);
  });

  it("queues one fault per request and stops injecting once drained", async () => {
    const fake = createFakeTransport();
    const token = await authenticate(fake);
    fake.control.failNext({ kind: "http", status: 503 }, 2);
    expect(fake.control.pendingFaults()).toHaveLength(2);

    expect((await fake.send(read(token))).status).toBe(503);
    expect((await fake.send(read(token))).status).toBe(503);
    expect(fake.control.pendingFaults()).toHaveLength(0);
    expect((await fake.send(read(token))).status).toBe(200);
  });

  it("clearFaults() and reset() drop what is queued", async () => {
    const fake = createFakeTransport();
    const token = await authenticate(fake);

    fake.control.failNext({ kind: "network" });
    fake.control.clearFaults();
    expect(fake.control.pendingFaults()).toHaveLength(0);

    fake.control.failNext({ kind: "network" });
    fake.control.reset();
    expect(fake.control.pendingFaults()).toHaveLength(0);
    // reset() also forgot the tokens, so the old one is no longer accepted.
    expect(resultCode((await fake.send(read(token))).body)).toBe(402);
  });
});

describe("fake transport latency", () => {
  it("waits the configured latency before answering", async () => {
    vi.useFakeTimers();
    try {
      const fake = createFakeTransport({ latencyMs: 50 });
      let settled = false;
      const pending = fake
        .send({ method: "GET", url: url("/v1/candidate"), headers: {} })
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
    const answer = await fake.send({
      method: "GET",
      url: url("/v1/candidate"),
      headers: {},
    });
    expect(resultCode(answer.body)).toBe(402);
  });
});

describe("fake transport state", () => {
  it("re-applies the seed on reset", () => {
    const fake = createFakeTransport({
      seed: { candidate: [{ P_Name: "既存 太郎", P_Owner: "5" }] },
    });
    expect(fake.control.records("candidate")).toHaveLength(1);

    fake.control.records("candidate").push({ P_Id: "99999" });
    fake.control.reset();

    const records = fake.control.records("candidate");
    expect(records).toHaveLength(1);
    expect(records[0]?.P_Name).toBe("既存 太郎");
  });
});
