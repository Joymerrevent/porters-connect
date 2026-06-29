import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, expectTypeOf, it } from "vitest";

import { PortersClient } from "./client";
import type { TenantScope } from "./client";
import type { Transport, TransportRequest } from "./http/types";
import type { UserRef } from "./xml/decode";

const candidateXml = readFileSync(
  fileURLToPath(
    new URL("../test/fixtures/candidate/read-basic.xml", import.meta.url),
  ),
  "utf8",
);

const mockClient = (): PortersClient => {
  const transport: Transport = {
    send: () => Promise.resolve({ status: 200, body: candidateXml }),
  };
  return new PortersClient({
    host: "example.test",
    partition: 999,
    transport,
    auth: { getAccessToken: () => Promise.resolve("TKN") },
  });
};

describe("PortersClient + candidate (E2E, mock transport)", () => {
  it("returns typed Candidate[] decoded from mock XML", async () => {
    const page = await mockClient().candidate.search({
      field: ["P_Id", "P_Name"],
      count: 200,
    });

    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(2);

    const first = page.items[0];
    expect(first?.P_Id).toBe(10001); // Id -> number
    expect(first?.P_Name).toBe("山田 太郎"); // Text -> string
    expect(first?.P_UpdateDate).toBe("2026-01-02T03:04:05Z"); // DateTime -> ISO
    expect((first?.P_Owner as UserRef | null)?.P_Name).toBe("採用 花子"); // User -> nested
    expect(first?.P_Phase).toEqual(["Option.P_PersonPhase_Applied"]); // Option -> array (ADR-0017)

    // empty value -> null
    expect(page.items[1]?.P_Mail).toBeNull();
  });

  it("get(id) returns a single candidate", async () => {
    const c = await mockClient().candidate.get(10001);
    expect(c?.P_Id).toBe(10001);
  });

  it("wires defaults (no transport/auth injected) and exposes host", () => {
    const c = new PortersClient({ host: "default.test" });
    expect(c.host).toBe("default.test");
  });

  // Drives the *default* auth provider (no `auth` injected) through a mock
  // transport, so the options threaded into createDefaultTokenProvider /
  // createCandidateResource are observable in the outgoing requests.
  const recordingTransport = (): {
    transport: Transport;
    calls: TransportRequest[];
  } => {
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        const body = req.url.includes("/v1/oauth")
          ? "<Authentication><Code>C</Code><Error>0</Error></Authentication>"
          : req.url.includes("/v1/token")
            ? "<Authentication><AccessToken>A</AccessToken><AccessTokenExpiresIn>1800000</AccessTokenExpiresIn><RefreshToken>R</RefreshToken><RefreshTokenExpiresIn>7200000</RefreshTokenExpiresIn><Error>0</Error></Authentication>"
            : `<Candidate Total="0" Count="0" Start="0"><Code>0</Code></Candidate>`;
        return Promise.resolve({ status: 200, body });
      },
    };
    return { transport, calls };
  };

  it("threads host / appId / appSecret / partition into the wired requests", async () => {
    const { transport, calls } = recordingTransport();
    const client = new PortersClient({
      host: "wired.test",
      appId: "AID",
      appSecret: "SEC",
      partition: 7,
      transport,
    });
    await client.candidate.search();

    const oauth = calls.find((c) => c.url.includes("/v1/oauth"));
    const token = calls.find((c) => c.url.includes("/v1/token"));
    const candidate = calls.find((c) => c.url.includes("/v1/candidate"));
    expect(oauth?.url).toContain("https://wired.test/v1/oauth");
    expect(oauth?.url).toContain("app_id=AID");
    expect(token?.body).toContain("secret=SEC");
    expect(candidate?.url).toContain("partition=7");
  });

  it("defaults missing appId / appSecret to empty (not a placeholder)", async () => {
    const { transport, calls } = recordingTransport();
    const client = new PortersClient({ host: "h.test", transport });
    await client.candidate.search();

    const oauth = calls.find((c) => c.url.includes("/v1/oauth"));
    const token = calls.find((c) => c.url.includes("/v1/token"));
    expect(oauth?.url).toContain("app_id=&response_type=code_direct");
    expect(token?.body).toContain("secret=&");
  });
});

describe("PortersClient + job (E2E, mock transport)", () => {
  it("exposes a job accessor; decodes a System[Reference] to an id", async () => {
    const jobXml =
      `<Job Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Job.P_Id>55</Job.P_Id>` +
      `<Job.P_Client><Client><Client.P_Id>500</Client.P_Id></Client></Job.P_Client>` +
      `</Item></Job>`;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: jobXml }),
    };
    const client = new PortersClient({
      host: "example.test",
      partition: 999,
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const page = await client.job.search();
    expect(page.items[0]?.P_Id).toBe(55); // Id -> number
    expect(page.items[0]?.P_Client).toBe(500); // System[Reference] -> id, via the client
  });
});

describe("PortersClient + client resource (E2E, mock transport)", () => {
  it("exposes a client accessor; get(id) hits /v1/client", async () => {
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        return Promise.resolve({
          status: 200,
          body: `<Client Total="1" Count="1" Start="0"><Code>0</Code><Item><Client.P_Id>33</Client.P_Id></Item></Client>`,
        });
      },
    };
    const client = new PortersClient({
      host: "example.test",
      partition: 999,
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const one = await client.client.get(33);
    expect(one?.P_Id).toBe(33); // Id -> number, via the wired Client accessor
    expect(calls[0]?.url).toContain("/v1/client?");
    expect(decodeURIComponent(calls[0]?.url ?? "")).toContain(
      "Client.P_Id:eq=33",
    );
  });
});

describe("PortersClient + process (E2E, mock transport)", () => {
  it("exposes a process accessor; decodes a System[Reference] to an id", async () => {
    const processXml =
      `<Process Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Process.P_Id>77</Process.P_Id>` +
      `<Process.P_Job><Job><Job.P_Id>900</Job.P_Id></Job></Process.P_Job>` +
      `</Item></Process>`;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: processXml }),
    };
    const client = new PortersClient({
      host: "example.test",
      partition: 999,
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const page = await client.process.search();
    expect(page.items[0]?.P_Id).toBe(77); // Id -> number
    expect(page.items[0]?.P_Job).toBe(900); // System[Reference] -> id, via the client
  });
});

describe("PortersClient + resume (E2E, mock transport)", () => {
  it("exposes a resume accessor; decodes Age (P_DateOfBirth) as a date", async () => {
    const resumeXml =
      `<Resume Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Resume.P_Id>88</Resume.P_Id>` +
      `<Resume.P_DateOfBirth>1990/01/02</Resume.P_DateOfBirth>` +
      `</Item></Resume>`;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: resumeXml }),
    };
    const client = new PortersClient({
      host: "example.test",
      partition: 999,
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const page = await client.resume.search();
    expect(page.items[0]?.P_Id).toBe(88); // Id -> number
    expect(page.items[0]?.P_DateOfBirth).toBe("1990-01-02"); // Age -> date, via the client
  });
});

describe("PortersClient + attachment (E2E, mock transport)", () => {
  it("exposes an attachment accessor; decodes the fixed fields", async () => {
    const attachmentXml =
      `<Attachment Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Id>11111</Id><ResourceId>10001</ResourceId><FileName>cv.pdf</FileName>` +
      `</Item></Attachment>`;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: attachmentXml }),
    };
    const client = new PortersClient({
      host: "example.test",
      partition: 999,
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const page = await client.attachment.search();
    expect(page.items[0]?.id).toBe(11111); // Id -> number, via the wired accessor
    expect(page.items[0]?.fileName).toBe("cv.pdf");
  });
});

describe("PortersClient.tenant (multi-tenant scope, ADR-0040 / F-3)", () => {
  // An empty Read envelope; parseResourcePage is root-name-agnostic, so one body fits every
  // accessor (data / attachment / master). `auth` injected -> no oauth dance, only resource calls.
  const recording = (): { transport: Transport; calls: TransportRequest[] } => {
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        return Promise.resolve({
          status: 200,
          body: `<R Total="0" Count="0" Start="0"><Code>0</Code></R>`,
        });
      },
    };
    return { transport, calls };
  };

  const tenantClient = (transport: Transport): PortersClient =>
    new PortersClient({
      host: "t.test",
      partition: 999, // client default
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

  it("routes tenant(id) calls to partition=<id>, overriding the client default", async () => {
    const rec = recording();
    await tenantClient(rec.transport).tenant(123).candidate.search();
    expect(rec.calls[0]?.url).toContain("partition=123");
    expect(rec.calls[0]?.url).not.toContain("partition=999");
  });

  it("leaves bare (untenanted) accessors on the client-default partition", async () => {
    const rec = recording();
    await tenantClient(rec.transport).candidate.search();
    expect(rec.calls[0]?.url).toContain("partition=999");
  });

  it("binds the partition across data, attachment and master accessors", async () => {
    const rec = recording();
    const t = tenantClient(rec.transport).tenant(42);
    await t.candidate.search(); // data resource
    await t.attachment.search(); // bespoke Attachment
    await t.user.search(); // master Read
    expect(rec.calls).toHaveLength(3);
    for (const c of rec.calls) expect(c.url).toContain("partition=42");
  });

  it("exposes partition-bound accessors and omits auth / partition / tenant (type)", () => {
    expectTypeOf<TenantScope>().toHaveProperty("candidate");
    expectTypeOf<TenantScope>().toHaveProperty("attachment");
    expectTypeOf<TenantScope>().toHaveProperty("user");
    expectTypeOf<TenantScope>().toHaveProperty("option");
    // App-level / discovery / non-nesting are intentionally absent from the scope.
    expectTypeOf<TenantScope>().not.toHaveProperty("auth");
    expectTypeOf<TenantScope>().not.toHaveProperty("partition");
    expectTypeOf<TenantScope>().not.toHaveProperty("tenant");
  });
});
