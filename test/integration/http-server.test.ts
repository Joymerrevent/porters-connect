// The fake over a real socket (ADR-0043 phase 5). Everything the in-process tests cover is already
// proven; what matters here is that the HTTP adapter does not change any of it — the same
// round-trips, the same injected failures, the same constraint answers, now with an actual
// request/response on the wire.
//
// Most cases here connect with the forwarding transport, which is library-independent and stays
// supported. The last describe is phase 6 (ADR-0047): the same fake reached by configuration
// alone — `host` + `scheme: "http"` — with nothing swapped out of the app.

import { afterEach, describe, expect, it, vi } from "vitest";

import { PortersClient } from "../../src/client";
import { resetInsecureSchemeWarning } from "../../src/http/insecure-http-warning";
import type { UserRef } from "../../src/xml/decode";
import { startFakeServer, type FakeServer } from "../fake/index";

const OWNER = { P_Id: 5, P_Type: "0", P_Name: "採用 花子", P_Mail: "h@ex.com" };

let running: FakeServer | undefined;

const serve = async (
  options: Parameters<typeof startFakeServer>[0] = {},
): Promise<{ server: FakeServer; porters: PortersClient }> => {
  const server = await startFakeServer({
    users: [OWNER],
    // Unimplemented routes are *meant* to be loud; keep the expected ones out of the test output.
    log: () => undefined,
    ...options,
  });
  running = server;
  const porters = new PortersClient({
    host: "fake.test", // unchanged app config — only the transport points elsewhere
    appId: "app-id",
    appSecret: "app-secret",
    partition: 1,
    transport: server.transport(),
  });
  return { server, porters };
};

afterEach(async () => {
  await running?.close();
  running = undefined;
});

describe("the fake over HTTP", () => {
  it("runs OAuth and a full round-trip across a real socket", async () => {
    const { porters } = await serve();

    const id = await porters.candidate.create({
      P_Owner: 5,
      P_Name: "山田 太郎",
      P_Phase: ["Option.P_Applied"],
      P_PhaseDate: "2026-01-02T03:04:05Z",
    });
    const created = await porters.candidate.get(id);

    expect(id).toBe(10001);
    expect(created?.P_Name).toBe("山田 太郎");
    expect(created?.P_Phase).toEqual(["Option.P_Applied"]);
    expect(created?.P_PhaseDate).toBe("2026-01-02T03:04:05Z");
    expect(created?.P_Owner as UserRef).toEqual(OWNER);

    await porters.candidate.update(id, { P_Name: "山田 太郎（更新）" });
    const page = await porters.candidate.search({
      condition: { P_Name: { part: "更新" } },
    });
    expect(page.total).toBe(1);
  });

  it("serves seeded data and the master reads", async () => {
    const { porters } = await serve({
      partitions: [1, 42],
      seed: { candidate: [{ P_Name: "既存 太郎", P_Owner: "5" }] },
    });

    expect((await porters.candidate.search()).total).toBe(1);
    expect((await porters.partition.search()).items.map((p) => p.P_Id)).toEqual(
      [1, 42],
    );
    expect((await porters.user.current())?.P_Id).toBe(1);
  });

  it("keeps fault injection working through the adapter", async () => {
    const { server, porters } = await serve();
    server.control.failNext({ kind: "resultCode", code: 403 });

    await expect(porters.candidate.search()).rejects.toMatchObject({
      name: "PortersResourceError",
      category: "permission",
      code: 403,
    });
  });

  it("re-authenticates over HTTP when the Access Token expires", async () => {
    const { server, porters } = await serve();
    await porters.candidate.create({ P_Owner: 5, P_Name: "山田 太郎" });

    server.control.expireAccessTokens();

    expect((await porters.candidate.search()).total).toBe(1);
  });

  it("really drops the connection when a rate limit is exceeded", async () => {
    const { porters } = await serve({ rateLimit: { readPerMinute: 1 } });
    await porters.candidate.search();

    // The socket is destroyed, so this is a genuine network failure — same shape the in-process
    // fake produces, but produced by the wire this time.
    await expect(porters.candidate.search()).rejects.toMatchObject({
      name: "PortersNetworkError",
      category: "network",
      retryable: true,
    });
  });

  it("answers an unimplemented route with a loud 501", async () => {
    const { server } = await serve();

    const response = await fetch(`${server.url}/v1/recruiter?partition=1`);

    expect(response.status).toBe(501);
    expect(await response.text()).toContain("no route for GET /v1/recruiter");
  });

  it("rejects a verb PORTERS does not use", async () => {
    const { server } = await serve();

    const response = await fetch(`${server.url}/v1/candidate`, {
      method: "DELETE",
    });

    // There is no delete API in PORTERS, and this fake will not invent one.
    expect(response.status).toBe(405);
  });

  it("can be driven by anything that speaks HTTP, not just the library", async () => {
    const { server } = await serve();

    // What a curl / another process would do: the OAuth envelope straight off the socket.
    const response = await fetch(
      `${server.url}/v1/oauth?app_id=demo&response_type=code_direct`,
    );

    expect(response.headers.get("content-type")).toBe(
      "application/xml; charset=UTF-8",
    );
    expect(await response.text()).toContain("<Code>fake-code-1</Code>");
  });
});

// Phase 6 (ADR-0047): the point of the scheme setting. An app that already runs against PORTERS
// reaches the fake by changing configuration only — the same two values it would set from the
// environment — with no transport swap and no library patch in between.
describe("an unmodified app, pointed at the fake by configuration alone", () => {
  it("connects with host + scheme: http, and says so once", async () => {
    const server = await startFakeServer({
      users: [OWNER],
      log: () => undefined,
    });
    running = server;
    resetInsecureSchemeWarning();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const porters = new PortersClient({
      host: new URL(server.url).host, // what PORTERS_HOST would carry: `127.0.0.1:<port>`
      scheme: "http",
      appId: "app-id",
      appSecret: "app-secret",
      partition: 1,
    });

    const id = await porters.candidate.create({
      P_Owner: 5,
      P_Name: "山田 太郎",
    });
    const created = await porters.candidate.get(id);

    expect(created?.P_Name).toBe("山田 太郎");
    expect(created?.P_Owner as UserRef).toEqual(OWNER);
    // Loopback earns no exemption: cleartext is announced, once per process (ADR-0047).
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
