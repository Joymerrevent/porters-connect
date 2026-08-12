// L1 integration: the *real* `PortersClient` driven end to end against the in-repo fake server
// (ADR-0043 phase 1). Nothing is stubbed above the `Transport` seam — OAuth, throttle, requester,
// XML encode/parse, decode and the Candidate accessor all run, so a wire-shape or lifecycle
// regression fails here rather than in a hand-written fixture that was updated to match.

import { describe, expect, it } from "vitest";

import { PortersClient } from "../../src/client";
import { defineFields } from "../../src/fields/define-fields";
import type { UserRef } from "../../src/xml/decode";
import { createFakeTransport } from "../fake/index";
import type { FakeTransportOptions } from "../fake/types";

const OWNER = {
  P_Id: 5,
  P_Type: "0",
  P_Name: "採用 花子",
  P_Mail: "hanako@example.com",
};

const setup = (options: FakeTransportOptions = {}) => {
  const fake = createFakeTransport({ users: [OWNER], ...options });
  const porters = new PortersClient({
    host: "fake.test",
    appId: "app-id",
    appSecret: "app-secret",
    partition: 1,
    transport: fake,
  });
  return { fake, porters };
};

describe("candidate round-trip against the fake server", () => {
  it("creates, reads back every Data Type, and updates", async () => {
    const { porters } = setup();

    const id = await porters.candidate.create({
      P_Owner: 5,
      P_Name: "山田 太郎",
      P_Mail: "taro@example.com",
      P_Phase: ["Option.P_PersonPhase_Applied"],
      P_PhaseDate: "2026-01-02T03:04:05Z",
    });
    expect(id).toBe(10001);

    const created = await porters.candidate.get(id);
    expect(created?.P_Id).toBe(id);
    expect(created?.P_Name).toBe("山田 太郎"); // Text
    expect(created?.P_Owner as UserRef).toEqual(OWNER); // User: ID in, nested out
    expect(created?.P_Phase).toEqual(["Option.P_PersonPhase_Applied"]); // Option: alias set
    expect(created?.P_PhaseDate).toBe("2026-01-02T03:04:05Z"); // DateTime: ISO <-> PORTERS
    // Server-owned: stamped by the fake, never sent by the caller.
    expect(created?.P_UpdateDate).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    );
    expect((created?.P_RegisteredBy as UserRef).P_Id).toBe(1);

    await porters.candidate.update(id, { P_Name: "山田 太郎（更新）" });
    const updated = await porters.candidate.get(id);
    expect(updated?.P_Name).toBe("山田 太郎（更新）");
    expect(updated?.P_Mail).toBe("taro@example.com"); // untouched field survives
  });

  it("searches with a typed condition, order and paging", async () => {
    const { porters } = setup();
    await porters.candidate.create({ P_Owner: 5, P_Name: "山田 太郎" });
    await porters.candidate.create({ P_Owner: 5, P_Name: "佐藤 次郎" });
    await porters.candidate.create({ P_Owner: 5, P_Name: "山田 花子" });

    const hits = await porters.candidate.search({
      condition: { P_Name: { part: "山田" } },
      order: [{ P_Id: "desc" }],
    });
    expect(hits.total).toBe(2);
    expect(hits.count).toBe(2);
    expect(hits.items.map((c) => c.P_Name)).toEqual(["山田 花子", "山田 太郎"]);

    const firstPage = await porters.candidate.search({ count: 1, start: 0 });
    expect(firstPage.total).toBe(3); // total ignores paging
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.start).toBe(0);

    const all = [];
    for await (const c of porters.candidate.searchAll()) all.push(c.P_Id);
    expect(all).toEqual([10001, 10002, 10003]);
  });

  it("round-trips a declared custom field (defineFields)", async () => {
    const fake = createFakeTransport({ users: [OWNER] });
    const porters = new PortersClient({
      host: "fake.test",
      appId: "app-id",
      appSecret: "app-secret",
      partition: 1,
      transport: fake,
      fields: defineFields({ candidate: (f) => ({ U_score: f.number() }) }),
    });

    const id = await porters.candidate.create({ P_Owner: 5, U_score: 42 });
    const record = await porters.candidate.get(id);
    expect(record?.U_score).toBe(42);
  });

  it("reads seeded records", async () => {
    const { porters } = setup({
      seed: { candidate: [{ P_Name: "既存 太郎", P_Owner: "5" }] },
    });
    const page = await porters.candidate.search();
    expect(page.total).toBe(1);
    expect(page.items[0]?.P_Name).toBe("既存 太郎");
  });

  it("returns per-item results from a bulk write", async () => {
    const { fake, porters } = setup();
    fake.control.failNext({ kind: "writeItemCodes", codes: [0, 133] });

    const result = await porters.candidate.createMany([
      { P_Owner: 5, P_Name: "一人目" },
      { P_Owner: 5, P_Name: "二人目" },
    ]);

    expect(result.hasFailures).toBe(true);
    expect(result.results.map((r) => r.code)).toEqual([0, 133]);
    expect(fake.control.records("candidate")).toHaveLength(1);
  });
});

describe("error paths against the fake server", () => {
  it("maps an injected Result Code to a typed PortersError", async () => {
    const { fake, porters } = setup();
    fake.control.failNext({ kind: "resultCode", code: 403 });

    await expect(porters.candidate.search()).rejects.toMatchObject({
      name: "PortersResourceError",
      category: "permission",
      code: 403,
    });
  });

  it("keeps the Result Code of a write rejected as a whole (ADR-0045)", async () => {
    const { fake, porters } = setup();
    // No <Item> comes back at all, so the reason is at the root. Without reading it the caller
    // used to get "write returned no result item" with `category: "unknown"` (RV-14).
    fake.control.failNext({ kind: "resultCode", code: 102 });

    await expect(
      porters.candidate.create({ P_Owner: 5, P_Name: "山田 太郎" }),
    ).rejects.toMatchObject({
      name: "PortersResourceError",
      code: 102,
      category: "validation",
      context: { resource: "Candidate", operation: "write" },
    });
  });

  it("classifies a gateway 5xx on the token round-trip, and retries it (ADR-0050)", async () => {
    const { fake, porters } = setup();
    // Queued before anything runs, so the fault lands on `/v1/oauth` — the first request the
    // library makes. Token acquisition sits in front of every call, so this used to fail the whole
    // operation as `unknown` / not retryable (RV-19). Four faults = initial + 3 retries.
    fake.control.failNext(
      { kind: "http", status: 503, body: "<html>maintenance</html>" },
      4,
    );

    await expect(porters.candidate.search()).rejects.toMatchObject({
      name: "PortersNetworkError",
      category: "server",
      retryable: true,
      code: null,
      httpStatus: 503,
    });
    // All four attempts were made: the retry budget is now reachable from the auth path too.
    expect(fake.control.pendingFaults()).toHaveLength(0);
  });

  it("recovers when the gateway 5xx on auth is transient (ADR-0050)", async () => {
    const { fake, porters } = setup();
    // One bad answer, then the gateway is healthy again — the caller never sees it.
    fake.control.failNext({ kind: "http", status: 503 });

    await expect(porters.candidate.search()).resolves.toMatchObject({
      total: 0,
    });
    expect(fake.control.pendingFaults()).toHaveLength(0);
  });

  it("classifies a gateway 5xx that never reached PORTERS (ADR-0044)", async () => {
    const { fake, porters } = setup();
    await porters.candidate.search(); // warm up auth, so the fault lands on the read

    // What a load balancer / maintenance page actually returns: an error status and no envelope.
    // Queued for every attempt (initial + 3 retries) so the retry budget runs out.
    fake.control.failNext(
      { kind: "http", status: 503, body: "<html>maintenance</html>" },
      4,
    );

    await expect(porters.candidate.search()).rejects.toMatchObject({
      name: "PortersNetworkError",
      category: "server",
      retryable: true,
      code: null, // no PORTERS code exists — an intermediary answered
      httpStatus: 503,
    });
    expect(fake.control.pendingFaults()).toHaveLength(0); // all four attempts were made
  });

  it("keeps the Result Code when an error status does carry an envelope", async () => {
    const { fake, porters } = setup();
    await porters.candidate.search();

    fake.control.failNext({
      kind: "http",
      status: 400,
      body: "<Candidate><Code>403</Code></Candidate>",
    });

    // Both channels disagree in specificity; the envelope wins and the status rides along.
    await expect(porters.candidate.search()).rejects.toMatchObject({
      name: "PortersResourceError",
      category: "permission",
      code: 403,
      httpStatus: 400,
    });
  });

  it("re-authenticates transparently when the Access Token expires", async () => {
    const { fake, porters } = setup();
    await porters.candidate.create({ P_Owner: 5, P_Name: "山田 太郎" });

    // The library still believes its token is good for ~30 minutes; only the server knows.
    fake.control.expireAccessTokens();

    const page = await porters.candidate.search();
    expect(page.total).toBe(1);
  });

  it("rejects an unknown partition with Result Code 404", async () => {
    const fake = createFakeTransport();
    const porters = new PortersClient({
      host: "fake.test",
      appId: "app-id",
      appSecret: "app-secret",
      partition: 999,
      transport: fake,
    });

    await expect(porters.candidate.search()).rejects.toMatchObject({
      category: "notFound",
      code: 404,
    });
  });

  it("fails loud on a resource outside the MVP", async () => {
    const { fake } = setup();
    // Recruiter et al. are v0.2+ in the library too; the fake must say so rather than answer empty.
    await expect(
      fake.send({
        method: "GET",
        url: "https://fake.test/v1/recruiter?partition=1",
        headers: {},
      }),
    ).rejects.toMatchObject({
      name: "PortersConfigError",
      category: "config",
    });
  });

  it("completes the browser code grant and rejects a stale code", async () => {
    const { fake, porters } = setup();

    await porters.auth.exchangeAuthorizationCode(
      fake.control.issueAuthorizationCode(),
    );
    expect(await porters.auth.getToken()).toMatch(/^fake-access-/);

    await expect(
      porters.auth.exchangeAuthorizationCode("never-issued"),
    ).rejects.toMatchObject({ name: "PortersAuthError", code: 103 });
  });
});
