import { describe, expect, expectTypeOf, it } from "vitest";

import { PortersClient } from "../client";
import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
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
    { requester: stub(body, calls), host: "h.test", partition: 12 },
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

// Type-level: PortersClient threads the declaration through to each accessor (ADR-0023 D1).
// No-ops at runtime; the typecheck gate verifies the assertions.
describe("custom fields — PortersClient generic typing", () => {
  it("adds declared custom fields to reads and writes", () => {
    const fields = defineFields({
      candidate: (f) => ({ U_score: f.number(), U_tags: f.option() }),
    });
    const porters = new PortersClient({ host: "h.test", fields });
    expect(porters).toBeInstanceOf(PortersClient); // construct OK + uses the value

    type Rec = NonNullable<Awaited<ReturnType<typeof porters.candidate.get>>>;
    expectTypeOf<Rec>()
      .toHaveProperty("U_score")
      .toEqualTypeOf<number | null | undefined>();
    expectTypeOf<Rec>()
      .toHaveProperty("U_tags")
      .toEqualTypeOf<string[] | null | undefined>();
    expectTypeOf<Rec>()
      .toHaveProperty("P_Name")
      .toEqualTypeOf<string | null | undefined>(); // standard fields still present

    type Create = Parameters<typeof porters.candidate.create>[0];
    expectTypeOf<Create>()
      .toHaveProperty("U_score")
      .toEqualTypeOf<number | null | undefined>(); // custom = optional on create
    expectTypeOf<Create>().toHaveProperty("P_Owner").toEqualTypeOf<number>(); // still required
  });

  it("leaves a client without `fields` unchanged (no custom keys)", () => {
    const plain = new PortersClient({ host: "h.test" });
    expect(plain).toBeInstanceOf(PortersClient);
    type Rec = NonNullable<Awaited<ReturnType<typeof plain.candidate.get>>>;
    expectTypeOf<Rec>().not.toHaveProperty("U_score");
  });
});
