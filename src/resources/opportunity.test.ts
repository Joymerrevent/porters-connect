import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { FieldValue, UserRef } from "../xml/decode";
import {
  OPPORTUNITY_DESCRIPTOR,
  createOpportunityResource,
} from "./opportunity";

// The generic Read/Write flow is unit-tested in resource.test.ts; here we pin the
// Opportunity-specific catalog (each field decodes by its Data Type) and config
// (root name `Opportunity`, path `opportunity`, alias prefix `Opportunity`).
const USER_FIELDS = ["P_Owner", "P_RegisteredBy", "P_UpdatedBy"];
const DATETIME_FIELDS = ["P_RegistrationDate", "P_UpdateDate", "P_PhaseDate"];
const OPTION_FIELDS = ["P_Phase"];
const TEXT_FIELDS = ["P_PhaseMemo", "P_Position"];
const REF_FIELDS = ["P_Client", "P_Recruiter"];

const ALL =
  `<?xml version="1.0"?><Opportunity Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Opportunity.P_Id>42</Opportunity.P_Id>` +
  REF_FIELDS.map(
    (f, i) =>
      `<Opportunity.${f}><Ref><Ref.P_Id>${70 + i}</Ref.P_Id></Ref></Opportunity.${f}>`,
  ).join("") +
  USER_FIELDS.map(
    (f, i) =>
      `<Opportunity.${f}><User><User.P_Id>${i + 1}</User.P_Id></User></Opportunity.${f}>`,
  ).join("") +
  DATETIME_FIELDS.map(
    (f, i) => `<Opportunity.${f}>2020/01/0${i + 1} 03:04:05</Opportunity.${f}>`,
  ).join("") +
  OPTION_FIELDS.map(
    (f) =>
      `<Opportunity.${f}><OptionRoot><Opt_${f}/></OptionRoot></Opportunity.${f}>`,
  ).join("") +
  TEXT_FIELDS.map((f) => `<Opportunity.${f}/>`).join("") +
  `</Item></Opportunity>`;

const READ_OK = `<?xml version="1.0"?><Opportunity Total="0" Count="0" Start="0"><Code>0</Code></Opportunity>`;
const WRITE_OK = `<?xml version="1.0"?><Opportunity><Item><Id>2001</Id><Code>0</Code></Item></Opportunity>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createOpportunityResource({
    requester: stub(body, calls),
    accessPoint: { host: "h.test" },
    partition: 12,
  });

describe("createOpportunityResource — decode catalog", () => {
  it("decodes every catalogued field by its Data Type", async () => {
    const calls: Call[] = [];
    const o = (await resource(calls, ALL).search()).items[0];
    // Closed ReadRecord has no string index (U1); read by-name through a loose view.
    const rec = o as Record<string, FieldValue | undefined>;

    expect(o.P_Id).toBe(42); // Id -> number
    REF_FIELDS.forEach((f, i) => expect(rec[f]).toBe(70 + i)); // System[Reference] -> id
    USER_FIELDS.forEach((f, i) =>
      expect((rec[f] as UserRef | null)?.P_Id).toBe(i + 1),
    ); // User -> nested ref
    DATETIME_FIELDS.forEach((f, i) =>
      expect(rec[f]).toBe(`2020-01-0${i + 1}T03:04:05Z`),
    ); // DateTime -> ISO (...Z)
    OPTION_FIELDS.forEach((f) => expect(rec[f]).toEqual([`Opt_${f}`])); // Option -> array
    TEXT_FIELDS.forEach((f) => expect(rec[f]).toBeNull()); // empty Text -> null (not "")
  });

  it("has no P_Deleted — PORTERS does not publish one for Opportunity", () => {
    // The absence is the fact, not an oversight. reference-catalog.test.ts checks it against
    // docs/reference in both directions; this pins the consequence for readers of the catalog.
    expect("P_Deleted" in OPPORTUNITY_DESCRIPTOR.fields).toBe(false);
  });
});

describe("createOpportunityResource — config & write", () => {
  it("create POSTs to /v1/opportunity with Opportunity-prefixed fields", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({
      P_Owner: 5,
      P_Client: 70,
      P_Recruiter: 71,
      P_Position: "TypeScript エンジニア",
    });
    expect(id).toBe(2001); // assigned id from the Write response
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/opportunity?partition=12");
    expect(req.body).toBe(
      "<Opportunity><Item>" +
        "<Opportunity.P_Owner>5</Opportunity.P_Owner>" +
        "<Opportunity.P_Client>70</Opportunity.P_Client>" +
        "<Opportunity.P_Recruiter>71</Opportunity.P_Recruiter>" +
        "<Opportunity.P_Position>TypeScript エンジニア</Opportunity.P_Position>" +
        "<Opportunity.P_Id>-1</Opportunity.P_Id>" +
        "</Item></Opportunity>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("get(id) sends an Opportunity.P_Id condition against /v1/opportunity", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_OK).get(7);
    expect(one).toBeUndefined(); // 0-item response
    expect(calls[0].req.url).toContain("https://h.test/v1/opportunity?");
    expect(decodeURIComponent(calls[0].req.url)).toContain(
      "Opportunity.P_Id:eq=7",
    );
  });

  it("expands both references in one round trip", async () => {
    const calls: Call[] = [];
    await resource(calls, READ_OK).search({
      field: ["P_Id"],
      expand: { P_Client: ["P_Name"], P_Recruiter: ["P_Name"] },
    });
    const url = decodeURIComponent(calls[0].req.url);
    // ADR-0058: each referenced prefix comes from its own descriptor.
    expect(url).toContain("Opportunity.P_Client(Client.P_Name)");
    expect(url).toContain("Opportunity.P_Recruiter(Recruiter.P_Name)");
  });
});
