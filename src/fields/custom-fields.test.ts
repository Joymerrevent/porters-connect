import { describe, expect, expectTypeOf, it } from "vitest";

import { PortersClient } from "../porters-client";
import type { PortersClientOptions, TenantScope } from "../porters-client";
import { PortersConfigError } from "../errors";
import type { Requester, RequestSpec } from "../http/requester";
import type { Transport, TransportRequest } from "../http/types";
import { ACTIVITY_DESCRIPTOR } from "../resources/activity";
import {
  CANDIDATE_DESCRIPTOR,
  createCandidateResource,
} from "../resources/candidate";
import { CLIENT_DESCRIPTOR } from "../resources/client";
import { CONTACT_DESCRIPTOR } from "../resources/contact";
import { CONTRACT_DESCRIPTOR } from "../resources/contract";
import { JOB_DESCRIPTOR } from "../resources/job";
import { OPPORTUNITY_DESCRIPTOR } from "../resources/opportunity";
import { PROCESS_DESCRIPTOR } from "../resources/process";
import { RECRUITER_DESCRIPTOR } from "../resources/recruiter";
import { RESUME_DESCRIPTOR } from "../resources/resume";
import { SALES_DESCRIPTOR } from "../resources/sales";
import { defineFields, type DeclaredCatalogs } from "./define-fields";

// R-16 end-to-end (ADR-0023): declared custom fields decode/encode by their declared Data
// Type (not the raw-string passthrough) and appear typed on reads / writes via PortersClient.

const custom = defineFields({
  candidate: (f) => ({ U_tags: f.option(), U_score: f.number() }),
}).candidate;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createCandidateResource(
    {
      requester: stub(body, calls),
      accessPoint: { hostname: "h.test" },
      partition: 12,
    },
    custom,
  );

describe("custom fields — runtime decode/encode dispatch", () => {
  it("decodes a declared U_ field by its Data Type (Option -> string[], Number -> number)", async () => {
    const body =
      `<?xml version="1.0"?><Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Person.P_Id>42</Person.P_Id>` +
      `<Person.U_tags><OptionRoot><Opt_A/><Opt_B/></OptionRoot></Person.U_tags>` +
      `<Person.U_score>87</Person.U_score>` +
      `</Item></Candidate>`;
    const calls: Call[] = [];
    const c = (await resource(calls, body).search()).items[0];
    expect(c.P_Id).toBe(42);
    expect(c.U_tags).toEqual(["Opt_A", "Opt_B"]); // Option -> array (not first-only / raw)
    expect(c.U_score).toBe(87); // Number -> number (not the raw string "87")
  });

  it("sends declared U_ fields in the default field set", async () => {
    const ok = `<?xml version="1.0"?><Candidate Total="0" Count="0" Start="0"><Code>0</Code></Candidate>`;
    const calls: Call[] = [];
    await resource(calls, ok).search();
    const url = decodeURIComponent(calls[0].req.url);
    expect(url).toContain("Person.U_tags");
    expect(url).toContain("Person.U_score");
  });

  it("encodes a declared Option U_ field as child elements on write", async () => {
    const writeOk = `<?xml version="1.0"?><Candidate><Item><Id>10001</Id><Code>0</Code></Item></Candidate>`;
    const calls: Call[] = [];
    await resource(calls, writeOk).create({
      P_Owner: 5,
      U_tags: ["Opt_A"],
      U_score: 87,
    });
    const body = calls[0].req.body;
    // Option -> nested empty elements (not the raw-string fallback `Opt_A`).
    expect(body).toContain("<Person.U_tags><Opt_A/></Person.U_tags>");
    expect(body).toContain("<Person.U_score>87</Person.U_score>");
  });
});

// The declaration is bound where the partition is (ADR-0087): `tenant(id, { fields })`. One client,
// two tenants, two declarations — each scope decodes by its own, and the URL asks for its own.
describe("custom fields — per-tenant declaration via tenant(id, { fields }) (ADR-0087)", () => {
  const body =
    `<?xml version="1.0"?><Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
    `<Person.P_Id>42</Person.P_Id><Person.U_score>87</Person.U_score>` +
    `</Item></Candidate>`;
  const clientWith = (calls: TransportRequest[]): PortersClient => {
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        return Promise.resolve({ status: 200, body });
      },
    };
    return new PortersClient({
      hostname: "h.test",
      transport,
      tokenProvider: {
        acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
      },
    });
  };

  it("decodes each scope by its own declaration from the same client", async () => {
    const asNumber = defineFields({
      candidate: (f) => ({ U_score: f.number() }),
    });
    const asText = defineFields({
      candidate: (f) => ({ U_score: f.singlelineText() }),
    });
    const calls: TransportRequest[] = [];
    const porters = clientWith(calls);

    const one = (
      await porters.tenant(1, { fields: asNumber }).candidate.search()
    ).items[0];
    const two = (await porters.tenant(2, { fields: asText }).candidate.search())
      .items[0];

    expect(one.U_score).toBe(87); // Number -> number
    expect(two.U_score).toBe("87"); // SinglelineText -> string (same XML, other tenant's declaration)
    expect(calls[0]?.url).toContain("partition=1");
    expect(calls[1]?.url).toContain("partition=2");
    // Declared fields join that scope's default `field` set (ADR-0020) — for both.
    expect(decodeURIComponent(calls[0]?.url ?? "")).toContain("Person.U_score");
    expect(decodeURIComponent(calls[1]?.url ?? "")).toContain("Person.U_score");
  });

  it("a scope without `fields` neither asks for nor types custom fields", async () => {
    const calls: TransportRequest[] = [];
    const plain = clientWith(calls).tenant(3);
    const page = await plain.candidate.search();
    expect(page.items[0]?.P_Id).toBe(42);
    expect(decodeURIComponent(calls[0]?.url ?? "")).not.toContain("U_score");
    type Rec = NonNullable<Awaited<ReturnType<typeof plain.candidate.get>>>;
    expectTypeOf<Rec>().not.toHaveProperty("U_score");
  });
});

// `buildScope` hands each resource factory its own slice of the declaration by key —
// `customFor("job")` and so on, eleven times. A key that is off by a character does not fail: it
// resolves to `{}` and that resource silently loses its custom fields (raw-string passthrough, no
// error). The tests above pin candidate only, which left the other ten lines unguarded (RV-59:
// mutating any of them to `customFor("")` passed the whole suite). This table pins all eleven, one
// alias per resource, so a key that is empty *or* swapped with another resource's is caught.
describe("custom fields — tenant(id, { fields }) reaches every data resource (RV-59)", () => {
  const fields = defineFields({
    candidate: (f) => ({ U_candidate: f.number() }),
    job: (f) => ({ U_job: f.number() }),
    client: (f) => ({ U_client: f.number() }),
    recruiter: (f) => ({ U_recruiter: f.number() }),
    contact: (f) => ({ U_contact: f.number() }),
    opportunity: (f) => ({ U_opportunity: f.number() }),
    activity: (f) => ({ U_activity: f.number() }),
    contract: (f) => ({ U_contract: f.number() }),
    sales: (f) => ({ U_sales: f.number() }),
    process: (f) => ({ U_process: f.number() }),
    resume: (f) => ({ U_resume: f.number() }),
  });
  type Scope = TenantScope<typeof fields>;
  type Searchable = {
    search: () => Promise<{ items: readonly Record<string, unknown>[] }>;
  };
  // Descriptor (root element + alias prefix for the fixture) and the accessor it must reach.
  const table: {
    descriptor: { name: string; path: string; prefix: string };
    pick: (t: Scope) => Searchable;
  }[] = [
    { descriptor: CANDIDATE_DESCRIPTOR, pick: (t) => t.candidate },
    { descriptor: JOB_DESCRIPTOR, pick: (t) => t.job },
    { descriptor: CLIENT_DESCRIPTOR, pick: (t) => t.client },
    { descriptor: RECRUITER_DESCRIPTOR, pick: (t) => t.recruiter },
    { descriptor: CONTACT_DESCRIPTOR, pick: (t) => t.contact },
    { descriptor: OPPORTUNITY_DESCRIPTOR, pick: (t) => t.opportunity },
    { descriptor: ACTIVITY_DESCRIPTOR, pick: (t) => t.activity },
    { descriptor: CONTRACT_DESCRIPTOR, pick: (t) => t.contract },
    { descriptor: SALES_DESCRIPTOR, pick: (t) => t.sales },
    { descriptor: PROCESS_DESCRIPTOR, pick: (t) => t.process },
    { descriptor: RESUME_DESCRIPTOR, pick: (t) => t.resume },
  ];

  it("covers every resource defineFields accepts", () => {
    // If a resource is added to `CustomFieldResource`, this table (and `buildScope`) must grow with it.
    expect(table.map((row) => row.descriptor.path).sort()).toEqual(
      Object.keys(fields).sort(),
    );
  });

  it.each(table)(
    "$descriptor.path decodes its own declaration and asks for it",
    async ({ descriptor, pick }) => {
      const alias = `U_${descriptor.path}`;
      const tag = `${descriptor.prefix}.${alias}`;
      const body =
        `<?xml version="1.0"?><${descriptor.name} Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
        `<${descriptor.prefix}.P_Id>42</${descriptor.prefix}.P_Id><${tag}>87</${tag}>` +
        `</Item></${descriptor.name}>`;
      const calls: TransportRequest[] = [];
      const porters = new PortersClient({
        hostname: "h.test",
        transport: {
          send: (req) => {
            calls.push(req);
            return Promise.resolve({ status: 200, body });
          },
        },
        tokenProvider: {
          acquire: () => Promise.resolve({ accessToken: { token: "TKN" } }),
        },
      });
      const page = await pick(porters.tenant(1, { fields })).search();
      // Number -> number: the declared Data Type was applied, not the raw-string passthrough.
      expect(page.items[0]?.[alias]).toBe(87);
      // And the declaration joined that resource's default `field` set (ADR-0020).
      expect(decodeURIComponent(calls[0]?.url ?? "")).toContain(tag);
    },
  );
});

// Type-level: `tenant(id, { fields })` threads the declaration through to each accessor of that
// scope (ADR-0023 D1 / ADR-0087). No-ops at runtime; the typecheck gate verifies the assertions.
describe("custom fields — tenant(id, { fields }) typing", () => {
  const fields = defineFields({
    candidate: (f) => ({ U_score: f.number(), U_tags: f.option() }),
  });

  it("adds declared custom fields to reads and writes of that scope", () => {
    const porters = new PortersClient({ hostname: "h.test" });
    const t = porters.tenant(1, { fields });
    expect(t.candidate).toBeDefined(); // construct OK + uses the value

    type Rec = NonNullable<Awaited<ReturnType<typeof t.candidate.get>>>;
    expectTypeOf<Rec>()
      .toHaveProperty("U_score")
      .toEqualTypeOf<number | null | undefined>();
    expectTypeOf<Rec>()
      .toHaveProperty("U_tags")
      .toEqualTypeOf<string[] | null | undefined>();
    expectTypeOf<Rec>()
      .toHaveProperty("P_Name")
      .toEqualTypeOf<string | null | undefined>(); // standard fields still present

    type Create = Parameters<typeof t.candidate.create>[0];
    expectTypeOf<Create>()
      .toHaveProperty("U_score")
      .toEqualTypeOf<number | null | undefined>(); // custom = optional on create
    expectTypeOf<Create>().toHaveProperty("P_Owner").toEqualTypeOf<number>(); // still required
  });

  it("leaves a scope without `fields` unchanged (no custom keys)", () => {
    const plain = new PortersClient({ hostname: "h.test" }).tenant(1);
    expect(plain.candidate).toBeDefined();
    type Rec = NonNullable<Awaited<ReturnType<typeof plain.candidate.get>>>;
    expectTypeOf<Rec>().not.toHaveProperty("U_score");
  });

  it("rejects the declaration on the client, at compile time and at runtime (ADR-0087 / ADR-0092)", () => {
    // A declaration describes one partition, so the App-level client has no place for it. A
    // `fields` that is silently ignored would drop every custom field without a trace, so the
    // constructor fails closed on it like on any other key it does not define (ADR-0092).
    expect(
      // @ts-expect-error -- `fields` is not a PortersClientOptions key: pass it to tenant()
      () => new PortersClient({ hostname: "h.test", fields }),
    ).toThrow(PortersConfigError);
    // A config object built elsewhere escapes the excess property check; the runtime check is
    // what stops it (and what a JS caller hits).
    const stale = { hostname: "h.test", fields };
    let caught: unknown;
    try {
      new PortersClient(stale);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PortersConfigError);
    const err = caught as PortersConfigError;
    expect(err.category).toBe("config");
    expect(err.message).toBe('PortersClient: unknown option "fields"');
    // `fields: undefined` is not a leftover declaration — an optional spread must not trip it.
    expect(
      () =>
        new PortersClient({
          hostname: "h.test",
          fields: undefined,
        } as PortersClientOptions),
    ).not.toThrow();
    // @ts-expect-error -- PortersClient is not generic: the catalog lives on TenantScope
    type _Never = PortersClient<typeof fields>;
  });
});

// 宣言で明示した必須は create / createMany の入力型で必須になる（ADR-0089）。update は任意のまま。
// 型だけの規則なので、実行時の断言は無い（typecheck が検証する）。
describe("custom fields — required on create (ADR-0089)", () => {
  const fields = defineFields({
    candidate: (f) => ({
      U_score: f.number({ required: true }),
      U_memo: f.multilineText(),
    }),
  });

  it("makes a `required: true` field required on create and createMany", () => {
    const t = new PortersClient({ hostname: "h.test" }).tenant(1, { fields });
    expect(t.candidate).toBeDefined();
    type Create = Parameters<typeof t.candidate.create>[0];
    expectTypeOf<Create>().toHaveProperty("U_score").toEqualTypeOf<number>();
    expectTypeOf<Create>()
      .toHaveProperty("U_memo")
      .toEqualTypeOf<string | null | undefined>(); // not declared required
    // @ts-expect-error -- U_score was declared required
    void (() => t.candidate.create({ P_Owner: 1 }));
    // @ts-expect-error -- createMany takes the same input
    void (() => t.candidate.createMany([{ P_Owner: 1 }]));
    void (() => t.candidate.create({ P_Owner: 1, U_score: 3 }));
  });

  it("leaves update optional", () => {
    const t = new PortersClient({ hostname: "h.test" }).tenant(1, { fields });
    expect(t.candidate).toBeDefined();
    type Update = Parameters<typeof t.candidate.update>[1];
    expectTypeOf<Update>()
      .toHaveProperty("U_score")
      .toEqualTypeOf<number | null | undefined>();
  });

  it("carries through TenantScope<typeof fields> with no extra type argument", () => {
    const use = (t: TenantScope<typeof fields>) => {
      // @ts-expect-error -- required even when the scope is typed by hand
      void t.candidate.create({ P_Owner: 1 });
    };
    expect(use).toBeTypeOf("function");
  });

  it("requires nothing when no field says so (the behaviour before `required` existed)", () => {
    const loose = defineFields({
      candidate: (f) => ({
        U_a: f.number({ required: false }),
        U_b: f.number(),
      }),
    });
    const t = new PortersClient({ hostname: "h.test" }).tenant(1, {
      fields: loose,
    });
    expect(t.candidate).toBeDefined();
    type Create = Parameters<typeof t.candidate.create>[0];
    expectTypeOf<Create>()
      .toHaveProperty("U_a")
      .toEqualTypeOf<number | null | undefined>();
    // The wide type every declaration fits: nothing is known to be required.
    type Wide = Parameters<
      TenantScope<DeclaredCatalogs>["candidate"]["create"]
    >[0];
    expectTypeOf<Wide>().toHaveProperty("P_Owner").toEqualTypeOf<number>();
  });

  // RV-59 と同じ理由で 11 種を 1 つずつ押さえる（RequiredFor のリソース名の取り違えを検出する）。
  it("threads each resource's own required fields to that resource", () => {
    const all = defineFields({
      candidate: (f) => ({ U_candidate: f.number({ required: true }) }),
      job: (f) => ({ U_job: f.number({ required: true }) }),
      client: (f) => ({ U_client: f.number({ required: true }) }),
      recruiter: (f) => ({ U_recruiter: f.number({ required: true }) }),
      contact: (f) => ({ U_contact: f.number({ required: true }) }),
      opportunity: (f) => ({ U_opportunity: f.number({ required: true }) }),
      activity: (f) => ({ U_activity: f.number({ required: true }) }),
      contract: (f) => ({ U_contract: f.number({ required: true }) }),
      sales: (f) => ({ U_sales: f.number({ required: true }) }),
      process: (f) => ({ U_process: f.number({ required: true }) }),
      resume: (f) => ({ U_resume: f.number({ required: true }) }),
    });
    type S = TenantScope<typeof all>;
    type In<K extends keyof S> = S[K] extends {
      create: (input: infer I) => unknown;
    }
      ? I
      : never;
    expectTypeOf<In<"candidate">>()
      .toHaveProperty("U_candidate")
      .toEqualTypeOf<number>();
    expectTypeOf<In<"job">>().toHaveProperty("U_job").toEqualTypeOf<number>();
    expectTypeOf<In<"client">>()
      .toHaveProperty("U_client")
      .toEqualTypeOf<number>();
    expectTypeOf<In<"recruiter">>()
      .toHaveProperty("U_recruiter")
      .toEqualTypeOf<number>();
    expectTypeOf<In<"contact">>()
      .toHaveProperty("U_contact")
      .toEqualTypeOf<number>();
    expectTypeOf<In<"opportunity">>()
      .toHaveProperty("U_opportunity")
      .toEqualTypeOf<number>();
    expectTypeOf<In<"activity">>()
      .toHaveProperty("U_activity")
      .toEqualTypeOf<number>();
    expectTypeOf<In<"contract">>()
      .toHaveProperty("U_contract")
      .toEqualTypeOf<number>();
    expectTypeOf<In<"sales">>()
      .toHaveProperty("U_sales")
      .toEqualTypeOf<number>();
    expectTypeOf<In<"process">>()
      .toHaveProperty("U_process")
      .toEqualTypeOf<number>();
    expectTypeOf<In<"resume">>()
      .toHaveProperty("U_resume")
      .toEqualTypeOf<number>();
    expect(Object.keys(all)).toHaveLength(11);
  });
});
