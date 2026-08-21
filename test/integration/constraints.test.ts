// The API's own constraints, end to end (ADR-0043 phase 4). Two sides have to agree here: the
// library guards *before* sending (request length, keyword length, batch size) and PORTERS enforces
// the same limits on the wire. These tests pin both, and — where they disagree — say so out loud.

import { describe, expect, it } from "vitest";

import { PortersClient } from "../../src/client";
import { MAX_REQUEST_LENGTH } from "../../src/http/requester";
import type { Transport, TransportRequest } from "../../src/http/types";
import { createFakeTransport } from "../fake/index";
import type { FakeTransportOptions } from "../fake/types";

// Counts what actually reached the server, so "the library stopped it" is distinguishable from
// "the server rejected it".
const setup = (options: FakeTransportOptions = {}) => {
  const fake = createFakeTransport(options);
  const sent: TransportRequest[] = [];
  const transport: Transport = {
    send: (req) => {
      sent.push(req);
      return fake.send(req);
    },
  };
  const porters = new PortersClient({
    host: "fake.test",
    appId: "app-id",
    appSecret: "app-secret",
    transport,
  });
  const resourceRequests = (): TransportRequest[] =>
    sent.filter((r) => r.url.includes("/v1/candidate"));
  return { fake, porters, resourceRequests };
};

describe("request length (~15000 characters)", () => {
  it("is caught by the library before anything is sent", async () => {
    const { porters, resourceRequests } = setup();
    await porters.tenant(1).candidate.search(); // warm up auth so only the guarded call is in question

    await expect(
      porters.tenant(1).candidate.search({
        condition: { P_Name: { part: "あ".repeat(MAX_REQUEST_LENGTH) } },
      }),
    ).rejects.toMatchObject({ name: "PortersConfigError", category: "config" });

    // One read (the warm-up) — the oversized one never left the process.
    expect(resourceRequests()).toHaveLength(1);
  });

  it("is still enforced by the server when nothing guards it", async () => {
    const { fake } = setup();

    // Straight at the transport: this is what the library's guard is protecting callers from.
    const answer = await fake.send({
      method: "GET",
      url: `https://fake.test/v1/candidate?partition=1&condition=${"x".repeat(MAX_REQUEST_LENGTH)}`,
      headers: {},
    });

    expect(answer.status).toBe(400);
  });

  it("exempts an attachment upload on both sides", async () => {
    const { porters } = setup();
    const content = "A".repeat(MAX_REQUEST_LENGTH * 2);

    const id = await porters.tenant(1).attachment.create({
      resource: 3,
      resourceId: 10001,
      contentType: "text/plain",
      fileName: "big.txt",
      content,
    });

    expect((await porters.tenant(1).attachment.get(id))?.content).toBe(content);
  });

  it("guards the keyword length client-side too", async () => {
    const { porters, resourceRequests } = setup();
    await porters.tenant(1).candidate.search();

    // The query is still encoded before anything is sent, but the failure arrives as a
    // **rejection** — `search(...).catch(...)` catches it like any other (ADR-0046 / RV-15).
    await expect(
      porters.tenant(1).candidate.search({ keywords: ["あ".repeat(101)] }),
    ).rejects.toMatchObject({
      name: "PortersConfigError",
      category: "config",
    });

    expect(resourceRequests()).toHaveLength(1);
  });
});

describe("per-minute request limits", () => {
  it("surfaces a closed connection as a retryable network error", async () => {
    const { porters } = setup({ rateLimit: { readPerMinute: 1 } });

    await porters.tenant(1).candidate.search(); // uses the single allowed read

    // The requester retries a network failure (bounded backoff) and then gives up.
    await expect(porters.tenant(1).candidate.search()).rejects.toMatchObject({
      name: "PortersNetworkError",
      category: "network",
      retryable: true,
    });
  });

  it("does not throttle a normal workload", async () => {
    // The library paces itself at 90% of the caps (ADR-0010), so the reference limits are not
    // reachable by ordinary use — this is the regression guard for that claim.
    const { porters } = setup();

    for (let i = 0; i < 30; i += 1) {
      await porters
        .tenant(1)
        .candidate.create({ P_Owner: 5, P_Name: `候補者 ${i}` });
    }

    expect((await porters.tenant(1).candidate.search()).total).toBe(30);
  });

  it("reports an HTTP 429 as a retryable rateLimit error (ADR-0044)", async () => {
    const { porters } = setup({
      rateLimit: { readPerMinute: 1, mode: "http429" },
    });
    await porters.tenant(1).candidate.search();

    // A body-less 429 carries no PORTERS envelope, so the status is the whole story: the requester
    // classifies it, retries while it lasts, and surfaces it with the status attached. This is the
    // one route by which `category: "rateLimit"` is produced at all (RV-3 / RV-13).
    await expect(porters.tenant(1).candidate.search()).rejects.toMatchObject({
      name: "PortersNetworkError",
      category: "rateLimit",
      retryable: true,
      code: null,
      httpStatus: 429,
    });
  });
});

describe("200 records per request", () => {
  // The server side (an oversized write answering Result Code 102) is covered in
  // `test/fake/fake-transport.test.ts`, where an authenticated raw request is easy to build.
  it("never happens through createMany, which batches first", async () => {
    const { porters, resourceRequests } = setup();

    await porters
      .tenant(1)
      .candidate.createMany(
        Array.from({ length: 250 }, () => ({ P_Owner: 5 })),
      );

    const writes = resourceRequests().filter((r) => r.method === "POST");
    for (const w of writes) {
      expect((w.body ?? "").split("<Item>").length - 1).toBeLessThanOrEqual(
        200,
      );
    }
  });
});
