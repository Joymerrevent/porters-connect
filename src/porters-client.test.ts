import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { PortersClient } from "./porters-client";
import type {
  PortersClientOptions,
  TenantOptions,
  TenantScope,
} from "./porters-client";
import { defineFields, type DeclaredCatalogs } from "./fields";
import { resetInsecureSchemeWarning } from "./http/insecure-scheme-warner";
import { resetSharedThrottles, sharedThrottleFor } from "./http/throttle";
import type { Throttle } from "./http/throttle";
import type { Transport, TransportRequest } from "./http/types";
import type { UserRef } from "./xml/field-value";

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
    hostname: "example.test",
    transport,
    tokenProvider: {
      acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
    },
  });
};

describe("PortersClient + candidate (E2E, mock transport)", () => {
  it("returns typed Candidate[] decoded from mock XML", async () => {
    const page = await mockClient()
      .tenant(999)
      .candidate.search({
        // Every field the assertions below read is requested: reading one that was not is a type
        // error now that the record is narrowed to `field` (ADR-0096).
        field: [
          "P_Id",
          "P_Name",
          "P_UpdateDate",
          "P_Owner",
          "P_Phase",
          "P_Mail",
        ],
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

  it("wires defaults (no transport/auth injected) and exposes hostname / port", () => {
    const c = new PortersClient({ hostname: "default.test" });
    expect(c.hostname).toBe("default.test");
    // 既定は scheme のポート＝ undefined（ADR-0078）。
    expect(c.port).toBeUndefined();

    const local = new PortersClient({ hostname: "127.0.0.1", port: 4010 });
    expect(local.hostname).toBe("127.0.0.1");
    expect(local.port).toBe(4010);
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
      hostname: "wired.test",
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
      hostname: "127.0.0.1",
      port: 4010,
      scheme: "http",
      appId: "AID",
      appSecret: "SECRET",
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
          hostname: "https://xxxxx.example.com",
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

  // appId / appSecret を省いた既定の取得は、送る前に止まる（空の値を PORTERS へ送らない）。
  it("stops before sending when the built-in flow has no appId / appSecret", async () => {
    const { transport, calls } = recordingTransport();
    const client = new PortersClient({ hostname: "h.test", transport });
    await expect(client.tenant(999).candidate.search()).rejects.toMatchObject({
      name: "PortersConfigError",
      category: "config",
      message: "appId and appSecret are required to obtain a token",
    });
    expect(calls).toHaveLength(0);
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
      hostname: "example.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
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
      hostname: "example.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
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
      hostname: "example.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
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
      hostname: "example.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
    });

    const page = await client.tenant(999).contact.search();
    expect(page.items[0]?.P_Id).toBe(66);
    expect(page.items[0]?.P_Name).toBe("問合 花子");
    // Contact and Recruiter share a field list; the prefix/path is what keeps them apart.
    expect(calls[0]?.url).toContain("/v1/contact?");
  });
});

describe("PortersClient + opportunity (E2E, mock transport)", () => {
  it("exposes an opportunity accessor; routes to /v1/opportunity", async () => {
    const xml =
      `<Opportunity Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Opportunity.P_Id>88</Opportunity.P_Id>` +
      `</Item></Opportunity>`;
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        return Promise.resolve({ status: 200, body: xml });
      },
    };
    const client = new PortersClient({
      hostname: "example.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
    });

    const page = await client.tenant(999).opportunity.search();
    expect(page.items[0]?.P_Id).toBe(88);
    expect(calls[0]?.url).toContain("/v1/opportunity?");
  });
});

describe("PortersClient + activity (E2E, mock transport)", () => {
  it("exposes an activity accessor; routes to /v1/activity", async () => {
    const xml =
      `<Activity Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Activity.P_Id>99</Activity.P_Id>` +
      `<Activity.P_Resource>5</Activity.P_Resource>` +
      `</Item></Activity>`;
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        return Promise.resolve({ status: 200, body: xml });
      },
    };
    const client = new PortersClient({
      hostname: "example.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
    });

    const page = await client.tenant(999).activity.search();
    expect(page.items[0]?.P_Id).toBe(99);
    expect(page.items[0]?.P_Resource).toBe(5); // Resource List: Client
    expect(calls[0]?.url).toContain("/v1/activity?");
  });
});

describe("PortersClient + contract (E2E, mock transport)", () => {
  it("exposes a contract accessor; routes to /v1/contract", async () => {
    const xml =
      `<Contract Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Contract.P_Id>101</Contract.P_Id>` +
      `<Contract.P_ContingentFee>500000</Contract.P_ContingentFee>` +
      `</Item></Contract>`;
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        return Promise.resolve({ status: 200, body: xml });
      },
    };
    const client = new PortersClient({
      hostname: "example.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
    });

    const page = await client.tenant(999).contract.search();
    expect(page.items[0]?.P_Id).toBe(101);
    expect(page.items[0]?.P_ContingentFee).toBe(500000); // Currency reads as a number
    expect(calls[0]?.url).toContain("/v1/contract?");
  });
});

describe("PortersClient + phase (E2E, mock transport)", () => {
  it("exposes a phase accessor bound through of(name)", async () => {
    const xml =
      `<Phase Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Id>10014</Id><Resource>5</Resource><ResourceId>20001</ResourceId>` +
      `</Item></Phase>`;
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        return Promise.resolve({ status: 200, body: xml });
      },
    };
    const client = new PortersClient({
      hostname: "example.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
    });

    const page = await client.tenant(999).phase.of("client").search();
    expect(page.items[0]?.Id).toBe(10014); // bare `Id`, no prefix
    expect(page.items[0]?.ResourceId).toBe(20001);
    expect(calls[0]?.url).toContain("/v1/phase?");
    expect(calls[0]?.url).toContain("resource=5"); // the binding travels as its own param
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
      hostname: "example.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
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
      hostname: "example.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
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
      hostname: "example.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
    });

    const page = await client.tenant(999).attachment.of("resume").search();
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
      hostname: "t.test", // client default
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
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
    await t.attachment.of("resume").search(); // bespoke Attachment
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

  // ADR-0087: the custom field declaration is bound with the partition, not on the client.
  it("binds a custom field declaration per scope via tenant(id, { fields }) (type)", () => {
    const fields = defineFields({
      candidate: (f) => ({ U_score: f.number() }),
    });
    const rec = recording();
    const porters = tenantClient(rec.transport);
    const declared = porters.tenant(1, { fields });
    const bare = porters.tenant(2);
    // The scope's type is exactly TenantScope<that declaration> — nothing wider, nothing narrower.
    expectTypeOf(declared).toEqualTypeOf<TenantScope<typeof fields>>();
    expectTypeOf(bare).toEqualTypeOf<TenantScope>();
    const options: TenantOptions<typeof fields> = { fields };
    expectTypeOf(porters.tenant(3, options)).toEqualTypeOf<
      TenantScope<typeof fields>
    >();
    // The client itself carries no declaration: it is not generic and has no `fields` option.
    expectTypeOf<PortersClientOptions>().not.toHaveProperty("fields");
    // @ts-expect-error -- PortersClient takes no type argument (ADR-0087)
    type _NotGeneric = PortersClient<typeof fields>;
  });

  it("tenant(id, { fields }) sends the declared fields for that partition only", async () => {
    const fields = defineFields({
      candidate: (f) => ({ U_score: f.number() }),
    });
    const rec = recording();
    const porters = tenantClient(rec.transport);
    await porters.tenant(1, { fields }).candidate.search();
    await porters.tenant(2).candidate.search();
    const urls = rec.calls.map((c) => decodeURIComponent(c.url));
    expect(urls[0]).toContain("partition=1");
    expect(urls[0]).toContain("Person.U_score"); // declared -> in the default field set (ADR-0020)
    expect(urls[1]).toContain("partition=2");
    expect(urls[1]).not.toContain("U_score"); // the other scope never saw the declaration
  });
});

// ADR-0073 / RV-43: バケットは client ごとではなく**宛先**ごと（ADR-0078 以降はホスト名＋ポート）。
// ガイドが勧めるとおりにテナント別 client を立てても、合計が 1 つの上限に収まることを pin する。
describe("PortersClient のスロットル（宛先ごとに共有・注入）", () => {
  const clientFor = (hostname: string, throttle?: Throttle): PortersClient =>
    new PortersClient({
      hostname,
      throttle,
      transport: {
        send: (req) =>
          Promise.resolve({
            status: 200,
            body:
              req.method === "GET"
                ? emptyPageFor(req.url)
                : "<Candidate><Item><Id>10001</Id><Code>0</Code></Item></Candidate>",
          }),
      },
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
    });

  it("同じホストの client は同じバケットを通る", async () => {
    resetSharedThrottles();
    const shared = sharedThrottleFor("example.test");
    const take = vi.spyOn(shared, "take");

    await clientFor("example.test").tenant(1).candidate.search();
    await clientFor("example.test").tenant(2).candidate.search();

    // 2 client ぶんの要求が、同じ実体を通っている＝バケットは増えていない
    expect(take).toHaveBeenCalledTimes(2);
    expect(take).toHaveBeenCalledWith(false); // Read
    take.mockRestore();
  });

  it("別ホストの client は別のバケットを通る", async () => {
    resetSharedThrottles();
    const take = vi.spyOn(sharedThrottleFor("example.test"), "take");

    await clientFor("other.test").tenant(1).candidate.search();

    expect(take).not.toHaveBeenCalled();
    take.mockRestore();
  });

  it("注入したスロットルが共有より優先される", async () => {
    resetSharedThrottles();
    const sharedTake = vi.spyOn(sharedThrottleFor("example.test"), "take");
    const mineTake = vi.fn(() => Promise.resolve());
    const mine: Throttle = { take: mineTake };

    await clientFor("example.test", mine).tenant(1).candidate.search();

    expect(mineTake).toHaveBeenCalledWith(false);
    expect(sharedTake).not.toHaveBeenCalled();
    sharedTake.mockRestore();
  });

  it("書き込みは write=true で通る", async () => {
    resetSharedThrottles();
    const mineTake = vi.fn(() => Promise.resolve());
    const mine: Throttle = { take: mineTake };

    await clientFor("example.test", mine)
      .tenant(1)
      .candidate.create({ P_Owner: 1 });

    expect(mineTake).toHaveBeenCalledWith(true);
  });
});

// 構築時に tokenProvider の形を確かめる（ADR-0091）。黙って受けると、最初のリクエストまで壊れていることに
// 気づけない。定義していないキー（auth など）の検査は下の describe（ADR-0092）。
describe("PortersClient — tokenProvider shape (ADR-0091)", () => {
  const build = (extra: Record<string, unknown>) => () =>
    new PortersClient({
      hostname: "h.test",
      ...extra,
    });

  it("names the old getAccessToken shape when it is passed as tokenProvider", () => {
    expect(
      build({ tokenProvider: { getAccessToken: () => Promise.resolve("T") } }),
    ).toThrow(
      expect.objectContaining({
        name: "PortersConfigError",
        category: "config",
        message:
          "PortersClient: tokenProvider has getAccessToken but no acquire — the old custom-auth shape",
        hint: expect.stringContaining("acquire: async () =>") as string,
      }),
    );
  });

  it.each([
    ["null", null],
    ["a string", "token"],
    ["an object without acquire", {}],
    ["acquire that is not a function", { acquire: "x" }],
    ["getAccessToken that is not a function", { getAccessToken: "x" }],
  ])("rejects %s as tokenProvider", (_, tokenProvider) => {
    expect(build({ tokenProvider })).toThrow(
      expect.objectContaining({
        name: "PortersConfigError",
        category: "config",
        message: "PortersClient: tokenProvider must have an acquire() method",
      }),
    );
  });

  it.each(["refresh", "exchange"])(
    "rejects a %s that is not a function",
    (name) => {
      expect(
        build({
          tokenProvider: { acquire: () => Promise.resolve(), [name]: "x" },
        }),
      ).toThrow(
        expect.objectContaining({
          name: "PortersConfigError",
          category: "config",
          message: `PortersClient: tokenProvider.${name} must be a function when given`,
          hint: `Remove ${name} or make it a method.`,
        }),
      );
    },
  );

  it("accepts acquire alone, and refresh / exchange as functions", () => {
    const acquire = () => Promise.resolve({ accessToken: { token: "T" } });
    expect(build({ tokenProvider: { acquire } })).not.toThrow();
    expect(
      build({
        tokenProvider: { acquire, refresh: acquire, exchange: acquire },
      }),
    ).not.toThrow();
  });

  it("uses tokenStore with a caller's tokenProvider", async () => {
    const saved: unknown[] = [];
    const porters = new PortersClient({
      hostname: "h.test",
      transport: {
        send: () =>
          Promise.resolve({
            status: 200,
            body: `<Candidate Total="0" Count="0" Start="0"><Code>0</Code></Candidate>`,
          }),
      },
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "T" } }),
      },
      tokenStore: {
        get: () => Promise.resolve(undefined),
        set: (t) => {
          saved.push(t);
          return Promise.resolve();
        },
        clear: () => Promise.resolve(),
      },
    });
    await porters.tenant(1).candidate.search();
    expect(saved).toEqual([{ accessToken: { token: "T" } }]);
  });
});

// 定義していないキーは、名前を問わず構築時・tenant() の呼び出し時に止める（ADR-0092）。黙って無視すると、
// 打ち間違えた設定のまま動く。許可する一覧は型のキーと satisfies で突き合わせている。
describe("unknown options are rejected (ADR-0092)", () => {
  const acquire = () => Promise.resolve({ accessToken: { token: "TKN" } });
  const construct = (options: Record<string, unknown>) => () =>
    new PortersClient({ hostname: "h.test", ...options });
  const VALID_CLIENT_KEYS =
    "Valid options: hostname, port, scheme, appId, appSecret, scopes, tokenProvider, tokenStore, transport, throttle.";

  it("rejects a key the client does not define, naming it and listing the valid ones", () => {
    expect(construct({ hostName: "typo.test" })).toThrow(
      expect.objectContaining({
        name: "PortersConfigError",
        category: "config",
        message: 'PortersClient: unknown option "hostName"',
        hint: VALID_CLIENT_KEYS,
      }),
    );
  });

  it("names every unknown key at once", () => {
    expect(construct({ auth: {}, timeout: 5 })).toThrow(
      'PortersClient: unknown options "auth", "timeout"',
    );
  });

  it("treats a retired name like any other unknown key", () => {
    expect(
      construct({ auth: { getAccessToken: () => Promise.resolve("T") } }),
    ).toThrow(
      expect.objectContaining({
        message: 'PortersClient: unknown option "auth"',
        hint: VALID_CLIENT_KEYS,
      }),
    );
  });

  it("does not count keys inherited from Object.prototype as defined", () => {
    expect(construct({ toString: "x" })).toThrow(
      'PortersClient: unknown option "toString"',
    );
  });

  it("lets an unknown key whose value is undefined through (an optional spread)", () => {
    expect(construct({ auth: undefined, fields: undefined })).not.toThrow();
  });

  it("accepts every key it defines", () => {
    expect(
      construct({
        port: 4010,
        scheme: "https",
        appId: "a",
        appSecret: "s",
        scopes: ["candidate_r"],
        tokenProvider: { acquire },
        tokenStore: {
          get: () => Promise.resolve(undefined),
          set: () => Promise.resolve(),
          clear: () => Promise.resolve(),
        },
        transport: {
          send: () => Promise.resolve({ status: 200, body: "" }),
        },
        throttle: { take: () => Promise.resolve() },
      }),
    ).not.toThrow();
  });

  it("refuses an unknown key in a fresh literal at compile time", () => {
    // @ts-expect-error -- not a PortersClientOptions key
    void (() => new PortersClient({ hostname: "h.test", hostName: "x" }));
    expectTypeOf<PortersClientOptions>().not.toHaveProperty("auth");
  });

  describe("tenant(id, options)", () => {
    const porters = new PortersClient({
      hostname: "h.test",
      tokenProvider: { acquire },
    });
    const fields = defineFields({
      candidate: (f) => ({ U_score: f.number() }),
    });

    it("rejects a key tenant() does not define, synchronously", () => {
      const options = { feilds: fields };
      expect(() =>
        porters.tenant(1, options as unknown as TenantOptions),
      ).toThrow(
        expect.objectContaining({
          name: "PortersConfigError",
          category: "config",
          message: 'tenant: unknown option "feilds"',
          hint: "Valid options: fields.",
        }),
      );
    });

    it("accepts fields, fields: undefined, and no options", () => {
      expect(() => porters.tenant(1, { fields })).not.toThrow();
      expect(() => porters.tenant(1, { fields: undefined })).not.toThrow();
      expect(() => porters.tenant(1)).not.toThrow();
    });
  });
});

// 型を field で絞ったあとも、宣言が違うスコープは取り違えられない（ADR-0074 D1・ADR-0096）。
describe("TenantScope — 宣言が違うスコープは渡せない", () => {
  it("rejects a scope declared differently, and accepts a declared scope where any is taken", () => {
    const scored = defineFields({
      candidate: (f) => ({ U_score: f.number() }),
    });
    const memo = defineFields({
      candidate: (f) => ({ U_memo: f.singlelineText() }),
    });
    const typeOnly = (
      a: TenantScope<typeof memo>,
      b: TenantScope<typeof scored>,
    ) => {
      // @ts-expect-error — U_score is not declared on this scope
      const wrong: TenantScope<typeof scored> = a;
      const any: TenantScope<DeclaredCatalogs> = b;
      return [wrong, any];
    };
    expect(typeOnly).toBeTypeOf("function");
    expect([scored, memo]).toHaveLength(2);
  });
});
