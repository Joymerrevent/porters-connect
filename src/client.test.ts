import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { PortersClient } from "./client";
import type { TenantScope } from "./client";
import { resetInsecureSchemeWarning } from "./http/insecure-http-warning";
import type { Transport, TransportRequest } from "./http/types";
import type { UserRef } from "./xml/decode";

const candidateXml = readFileSync(
  fileURLToPath(
    new URL("../test/fixtures/candidate/read-basic.xml", import.meta.url),
  ),
  "utf8",
);

// ADR-0051: a Read answer is identified by its root element, so a canned reply has to be the
// envelope of whatever resource the URL asked for — `/v1/candidate` -> `<Candidate>`. One body
// no longer fits every accessor.
const emptyPageFor = (url: string): string => {
  const path = new URL(url).pathname.split("/").pop() ?? "";
  const root = path.charAt(0).toUpperCase() + path.slice(1);
  return `<${root} Total="0" Count="0" Start="0"><Code>0</Code></${root}>`;
};

const mockClient = (): PortersClient => {
  const transport: Transport = {
    send: () => Promise.resolve({ status: 200, body: candidateXml }),
  };
  return new PortersClient({
    host: "example.test",
    transport,
    auth: { getAccessToken: () => Promise.resolve("TKN") },
  });
};

describe("PortersClient + candidate (E2E, mock transport)", () => {
  it("returns typed Candidate[] decoded from mock XML", async () => {
    const page = await mockClient()
      .tenant(999)
      .candidate.search({
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
    const c = await mockClient().tenant(999).candidate.get(10001);
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
            : emptyPageFor(req.url);
        return Promise.resolve({ status: 200, body });
      },
    };
    return { transport, calls };
  };

  it("threads host / appId / appSecret と tenant(id) の partition を配線する", async () => {
    const { transport, calls } = recordingTransport();
    const client = new PortersClient({
      host: "wired.test",
      appId: "AID",
      appSecret: "SEC",
      transport,
    });
    await client.tenant(7).candidate.search(); // partition は tenant で束ねる（ADR-0055）

    const oauth = calls.find((c) => c.url.includes("/v1/oauth"));
    const token = calls.find((c) => c.url.includes("/v1/token"));
    const candidate = calls.find((c) => c.url.includes("/v1/candidate"));
    expect(oauth?.url).toContain("https://wired.test/v1/oauth");
    expect(oauth?.url).toContain("app_id=AID");
    expect(token?.body).toContain("secret=SEC");
    expect(candidate?.url).toContain("partition=7");
  });

  // ADR-0047: the access point is one setting, applied to every URL the library builds — auth,
  // data resources and the App-level Partition master alike — and http is announced, not assumed.
  it("sends every URL to the configured scheme, warning once about cleartext", async () => {
    resetInsecureSchemeWarning();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { transport, calls } = recordingTransport();
    const client = new PortersClient({
      host: "127.0.0.1:4010",
      scheme: "http",
      appId: "AID",
      transport,
    });
    await client.tenant(999).candidate.search();
    await client.partition.search();

    expect(calls.map((c) => c.url.split("?")[0])).toEqual([
      "http://127.0.0.1:4010/v1/oauth",
      "http://127.0.0.1:4010/v1/token",
      "http://127.0.0.1:4010/v1/candidate",
      "http://127.0.0.1:4010/v1/partition",
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("refuses a malformed host at construction, before anything is sent (ADR-0048)", () => {
    resetInsecureSchemeWarning();
    const { transport, calls } = recordingTransport();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // `PORTERS_HOST` with the scheme included: the mistake that used to build
    // `https://https://xxxxx.example.com/v1/oauth` and post the App Secret to whatever `https`
    // resolves to. It now fails where the configuration was handed over. `scheme: "http"` is set
    // so the cleartext warning *would* fire — the check runs first.
    expect(
      () =>
        new PortersClient({
          host: "https://xxxxx.example.com",
          scheme: "http",
          appId: "AID",
          appSecret: "SECRET",
          transport,
        }),
    ).toThrow(
      expect.objectContaining({
        name: "PortersConfigError",
        category: "config",
      }),
    );

    expect(calls).toHaveLength(0); // nothing was sent — no credential left the process
    expect(warn).not.toHaveBeenCalled(); // and no cleartext warning about a config that is invalid
    warn.mockRestore();
  });

  it("defaults missing appId / appSecret to empty (not a placeholder)", async () => {
    const { transport, calls } = recordingTransport();
    const client = new PortersClient({ host: "h.test", transport });
    await client.tenant(999).candidate.search();

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
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const page = await client.tenant(999).job.search();
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
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const one = await client.tenant(999).client.get(33);
    expect(one?.P_Id).toBe(33); // Id -> number, via the wired Client accessor
    expect(calls[0]?.url).toContain("/v1/client?");
    expect(decodeURIComponent(calls[0]?.url ?? "")).toContain(
      "Client.P_Id:eq=33",
    );
  });
});

describe("PortersClient + recruiter (E2E, mock transport)", () => {
  it("exposes a recruiter accessor; decodes its P_Client reference to an id", async () => {
    const recruiterXml =
      `<Recruiter Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Recruiter.P_Id>55</Recruiter.P_Id>` +
      `<Recruiter.P_Client><Client><Client.P_Id>33</Client.P_Id></Client></Recruiter.P_Client>` +
      `</Item></Recruiter>`;
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        return Promise.resolve({ status: 200, body: recruiterXml });
      },
    };
    const client = new PortersClient({
      host: "example.test",
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const page = await client.tenant(999).recruiter.search();
    expect(page.items[0]?.P_Id).toBe(55); // Id -> number
    expect(page.items[0]?.P_Client).toBe(33); // System[Reference] -> id, via the client
    expect(calls[0]?.url).toContain("/v1/recruiter?");
  });
});

describe("PortersClient + contact (E2E, mock transport)", () => {
  it("exposes a contact accessor; routes to /v1/contact", async () => {
    const contactXml =
      `<Contact Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Contact.P_Id>66</Contact.P_Id>` +
      `<Contact.P_Name>問合 花子</Contact.P_Name>` +
      `</Item></Contact>`;
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        return Promise.resolve({ status: 200, body: contactXml });
      },
    };
    const client = new PortersClient({
      host: "example.test",
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const page = await client.tenant(999).contact.search();
    expect(page.items[0]?.P_Id).toBe(66);
    expect(page.items[0]?.P_Name).toBe("問合 花子");
    // Contact and Recruiter share a field list; the prefix/path is what keeps them apart.
    expect(calls[0]?.url).toContain("/v1/contact?");
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
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const page = await client.tenant(999).process.search();
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
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const page = await client.tenant(999).resume.search();
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
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

    const page = await client.tenant(999).attachment.search();
    expect(page.items[0]?.id).toBe(11111); // Id -> number, via the wired accessor
    expect(page.items[0]?.fileName).toBe("cv.pdf");
  });
});

describe("PortersClient.tenant (multi-tenant scope, ADR-0040 / F-3)", () => {
  // An empty Read envelope per accessor (data / attachment / master) — the root has to match the
  // resource in the URL (ADR-0051). `auth` injected -> no oauth dance, only resource calls.
  const recording = (): { transport: Transport; calls: TransportRequest[] } => {
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        return Promise.resolve({ status: 200, body: emptyPageFor(req.url) });
      },
    };
    return { transport, calls };
  };

  const tenantClient = (transport: Transport): PortersClient =>
    new PortersClient({
      host: "t.test", // client default
      transport,
      auth: { getAccessToken: () => Promise.resolve("TKN") },
    });

  it("routes tenant(id) calls to partition=<id>, overriding the client default", async () => {
    const rec = recording();
    await tenantClient(rec.transport).tenant(123).candidate.search();
    expect(rec.calls[0]?.url).toContain("partition=123");
    expect(rec.calls[0]?.url).not.toContain("partition=999");
  });

  it("client 直下には partition スコープのアクセサを生やさない（型・ADR-0055）", () => {
    // 「未束縛のまま呼ぶ」という状態自体を型で存在させない＝ガードではなく設計で防ぐ。
    // client に残るのは partition を取らないものだけ。
    expectTypeOf<PortersClient>().not.toHaveProperty("candidate");
    expectTypeOf<PortersClient>().not.toHaveProperty("job");
    expectTypeOf<PortersClient>().not.toHaveProperty("attachment");
    expectTypeOf<PortersClient>().not.toHaveProperty("user");
    expectTypeOf<PortersClient>().not.toHaveProperty("field");
    expectTypeOf<PortersClient>().not.toHaveProperty("option");
    expectTypeOf<PortersClient>().toHaveProperty("auth"); // App レベル
    expectTypeOf<PortersClient>().toHaveProperty("partition"); // 発見用（partition を取らない）
    expectTypeOf<PortersClient>().toHaveProperty("tenant");
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
