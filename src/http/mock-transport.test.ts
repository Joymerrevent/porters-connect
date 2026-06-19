import { describe, expect, it } from "vitest";

import { PortersClient } from "../client";
import { PortersConfigError, PortersError } from "../errors/index";
import { createMockTransport } from "./mock-transport";
import type { TransportRequest } from "./types";

const req = (
  url: string,
  method: TransportRequest["method"] = "GET",
): TransportRequest => ({ method, url, headers: {} });

describe("createMockTransport", () => {
  it("auto-answers the OAuth + token endpoints by default", async () => {
    const t = createMockTransport(() => undefined);
    const oauth = await t.send(
      req("https://h.test/v1/oauth?response_type=code_direct"),
    );
    const token = await t.send(req("https://h.test/v1/token", "POST"));
    expect(oauth.body).toContain("<Code>mock-code</Code>");
    expect(token.body).toContain(
      "<AccessToken>mock-access-token</AccessToken>",
    );
    expect(token.body).toContain(
      "<RefreshToken>mock-refresh-token</RefreshToken>",
    );
  });

  it("coerces a string reply to a 200 response", async () => {
    const t = createMockTransport(
      () => "<Candidate><Code>0</Code></Candidate>",
    );
    const res = await t.send(req("https://h.test/v1/candidate"));
    expect(res).toEqual({
      status: 200,
      body: "<Candidate><Code>0</Code></Candidate>",
    });
  });

  it("passes through an explicit status + body", async () => {
    const t = createMockTransport(() => ({
      status: 403,
      body: "<Error>1</Error>",
    }));
    const res = await t.send(req("https://h.test/v1/candidate"));
    expect(res).toEqual({ status: 403, body: "<Error>1</Error>" });
  });

  it("defaults an object reply without a status to 200", async () => {
    const t = createMockTransport(() => ({
      body: "<Candidate><Code>0</Code></Candidate>",
    }));
    const res = await t.send(req("https://h.test/v1/candidate"));
    expect(res).toEqual({
      status: 200,
      body: "<Candidate><Code>0</Code></Candidate>",
    });
  });

  it("throws a clear PortersConfigError for an unmocked route (fail-safe)", async () => {
    const t = createMockTransport(() => undefined);
    await expect(
      t.send(req("https://h.test/v1/job", "GET")),
    ).rejects.toMatchObject({
      category: "config",
    });
    await expect(
      t.send(req("https://h.test/v1/job", "GET")),
    ).rejects.toBeInstanceOf(PortersConfigError);
    // the message names method + path; the long default-field query is dropped
    const msg = await t
      .send(req("https://h.test/v1/job?field=Job.P_Id,Job.P_Owner"))
      .then(() => "")
      .catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
    expect(msg).toContain("GET /v1/job");
    expect(msg).not.toContain("field=");
  });

  it("falls back to the raw url in the message when it is not parseable", async () => {
    const t = createMockTransport(() => undefined);
    const msg = await t
      .send(req("not-a-valid-url"))
      .then(() => "")
      .catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
    expect(msg).toContain("GET not-a-valid-url");
  });

  it("with { auth: false } routes the auth endpoints to the handler", async () => {
    const t = createMockTransport(() => undefined, { auth: false });
    await expect(
      t.send(req("https://h.test/v1/token", "POST")),
    ).rejects.toBeInstanceOf(PortersConfigError);
  });

  it("drives a PortersClient fully offline (auth auto-answered + resource decoded)", async () => {
    const porters = new PortersClient({
      host: "sandbox.invalid",
      appId: "demo",
      appSecret: "demo",
      partition: 1,
      transport: createMockTransport((r) =>
        r.url.includes("/v1/candidate")
          ? `<Candidate Total="1" Count="1" Start="0"><Code>0</Code>` +
            `<Item><Person.P_Id>1</Person.P_Id><Person.P_Name>太郎</Person.P_Name></Item></Candidate>`
          : undefined,
      ),
    });
    const page = await porters.candidate.search();
    expect(page.total).toBe(1);
    expect(page.items[0]?.P_Id).toBe(1);
    expect(page.items[0]?.P_Name).toBe("太郎");
  });

  it("surfaces the unmocked-route error through the client as a PortersError", async () => {
    const porters = new PortersClient({
      host: "sandbox.invalid",
      appId: "demo",
      appSecret: "demo",
      partition: 1,
      transport: createMockTransport(() => undefined),
    });
    await expect(porters.candidate.search()).rejects.toBeInstanceOf(
      PortersError,
    );
  });
});
