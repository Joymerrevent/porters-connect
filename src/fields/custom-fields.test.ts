import { describe, expect, expectTypeOf, it } from "vitest";

import { PortersClient } from "../client";
import type { PortersClientOptions } from "../client";
import { PortersConfigError } from "../errors";
import type { Requester, RequestSpec } from "../http/requester";
import type { Transport, TransportRequest } from "../http/types";
import { createCandidateResource } from "../resources/candidate";
import { defineFields } from "./define-fields";

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
      auth: { getAccessToken: () => Promise.resolve("TKN") },
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

  it("rejects the declaration on the client, at compile time and at runtime (ADR-0087)", () => {
    // A declaration describes one partition, so the App-level client has no place for it. A
    // pre-0.21 `fields` that is silently ignored would drop every custom field without a trace,
    // so the constructor fails closed instead (same stance as a malformed `hostname`, ADR-0048).
    expect(
      // @ts-expect-error -- `fields` left PortersClientOptions (ADR-0087): pass it to tenant()
      () => new PortersClient({ hostname: "h.test", fields }),
    ).toThrow(PortersConfigError);
    // The non-fresh case is what the type alone would let through (no excess property check);
    // `fields?: never` closes it statically, and the cast below is what a JS caller looks like.
    const stale = { hostname: "h.test", fields };
    // @ts-expect-error -- a stale config object still carrying `fields` does not compile either
    void (() => new PortersClient(stale));
    let caught: unknown;
    try {
      new PortersClient(stale as unknown as PortersClientOptions);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PortersConfigError);
    const err = caught as PortersConfigError;
    expect(err.category).toBe("config");
    expect(err.message).toContain("not a client option"); // no ADR number: users need the fix, not the record
    expect(err.hint).toContain("tenant(id, { fields })");
    // `fields: undefined` is not a leftover declaration — an optional spread must not trip it.
    expect(
      () => new PortersClient({ hostname: "h.test", fields: undefined }),
    ).not.toThrow();
    // @ts-expect-error -- PortersClient is not generic: the catalog lives on TenantScope
    type _Never = PortersClient<typeof fields>;
  });
});
