import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { FieldValue, UserRef } from "../xml/decode";
import { SALES_DESCRIPTOR, createSalesResource } from "./sales";

// The generic Read/Write flow is unit-tested in resource.test.ts; here we pin the
// Sales-specific catalog (each field decodes by its Data Type) and config
// (root name `Sales`, path `sales`, alias prefix `Sales`).
const REF_FIELDS = [
  "P_Client",
  "P_Recruiter",
  "P_Job",
  "P_Contract",
  "P_Candidate",
  "P_Resume",
];
const USER_FIELDS = ["P_Owner", "P_RegisteredBy", "P_UpdatedBy"];
const DATE_FIELDS = ["P_RecordDate", "P_EnterDate"];
const TEXT_FIELDS = [
  "P_BillingClient",
  "P_BillingDivision",
  "P_BillingTitle",
  "P_BillingName",
  "P_BillingZipcode",
  "P_BillingCountry",
  "P_BillingPrefecture",
  "P_BillingCity",
  "P_BillingStreet",
];

const ALL =
  `<?xml version="1.0"?><Sales Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Sales.P_Id>42</Sales.P_Id>` +
  `<Sales.P_SalesAmount>1200000</Sales.P_SalesAmount>` +
  REF_FIELDS.map(
    (f, i) => `<Sales.${f}><R><R.P_Id>${300 + i}</R.P_Id></R></Sales.${f}>`,
  ).join("") +
  USER_FIELDS.map(
    (f, i) =>
      `<Sales.${f}><User><User.P_Id>${i + 1}</User.P_Id></User></Sales.${f}>`,
  ).join("") +
  DATE_FIELDS.map((f, i) => `<Sales.${f}>2021/03/0${i + 1}</Sales.${f}>`).join(
    "",
  ) +
  TEXT_FIELDS.map((f) => `<Sales.${f}/>`).join("") +
  `</Item></Sales>`;

const READ_OK = `<?xml version="1.0"?><Sales Total="0" Count="0" Start="0"><Code>0</Code></Sales>`;
const WRITE_OK = `<?xml version="1.0"?><Sales><Item><Id>2001</Id><Code>0</Code></Item></Sales>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createSalesResource({
    requester: stub(body, calls),
    accessPoint: { host: "h.test" },
    partition: 12,
  });

describe("createSalesResource — decode catalog", () => {
  it("decodes every catalogued field by its Data Type", async () => {
    const calls: Call[] = [];
    const s = (await resource(calls, ALL).search()).items[0];
    // Closed ReadRecord has no string index (U1); read by-name through a loose view.
    const rec = s as Record<string, FieldValue | undefined>;

    expect(s.P_Id).toBe(42); // Id -> number
    expect(s.P_SalesAmount).toBe(1200000); // Currency -> Number
    REF_FIELDS.forEach((f, i) => expect(rec[f]).toBe(300 + i)); // System[Reference] -> id
    USER_FIELDS.forEach((f, i) =>
      expect((rec[f] as UserRef | null)?.P_Id).toBe(i + 1),
    ); // User -> nested ref
    DATE_FIELDS.forEach((f, i) => expect(rec[f]).toBe(`2021-03-0${i + 1}`)); // Date -> ISO date
    TEXT_FIELDS.forEach((f) => expect(rec[f]).toBeNull()); // empty Text -> null (not "")
  });

  it("leaves the display-only `Reference` mirrors out of the catalog", () => {
    // P_*Owner (Field Type 16) mirror the referenced record's owner and carry no value of
    // their own, so requesting them would return nothing to decode.
    for (const alias of [
      "P_ClientOwner",
      "P_RecruiterOwner",
      "P_JobOwner",
      "P_CandidateOwner",
      "P_ResumeOwner",
    ]) {
      expect(alias in SALES_DESCRIPTOR.fields).toBe(false);
    }
  });
});

describe("createSalesResource — config & write", () => {
  it("requires only P_Owner on create — the six references are conditional (`※`)", async () => {
    // PORTERS validates a dependency chain (Job -> Recruiter -> Client <- Contract, and
    // Candidate+Resume together) that a flat required-list cannot express. Rejecting here
    // would block calls the server accepts, so the library sends what it is given.
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({ P_Owner: 5 });
    expect(id).toBe(2001);
    expect(calls[0].req.body).toBe(
      "<Sales><Item>" +
        "<Sales.P_Owner>5</Sales.P_Owner>" +
        "<Sales.P_Id>-1</Sales.P_Id>" +
        "</Item></Sales>",
    );
  });

  it("create POSTs to /v1/sales with Sales-prefixed fields", async () => {
    const calls: Call[] = [];
    await resource(calls, WRITE_OK).create({
      P_Owner: 5,
      P_Client: 300,
      P_Recruiter: 301,
      P_SalesAmount: 1200000,
    });
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/sales?partition=12");
    expect(req.body).toBe(
      "<Sales><Item>" +
        "<Sales.P_Owner>5</Sales.P_Owner>" +
        "<Sales.P_Client>300</Sales.P_Client>" +
        "<Sales.P_Recruiter>301</Sales.P_Recruiter>" +
        "<Sales.P_SalesAmount>1200000</Sales.P_SalesAmount>" +
        "<Sales.P_Id>-1</Sales.P_Id>" +
        "</Item></Sales>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("expands every one of the six references, each with its own prefix", async () => {
    const calls: Call[] = [];
    await resource(calls, READ_OK).search({
      field: ["P_Id"],
      expand: {
        P_Client: ["P_Name"],
        P_Recruiter: ["P_Name"],
        P_Job: ["P_Position"],
        P_Contract: ["P_Name"],
        P_Candidate: ["P_Name"],
        P_Resume: ["P_Name"],
      },
    });
    const url = decodeURIComponent(calls[0].req.url);
    expect(url).toContain("Sales.P_Client(Client.P_Name)");
    expect(url).toContain("Sales.P_Recruiter(Recruiter.P_Name)");
    expect(url).toContain("Sales.P_Job(Job.P_Position)");
    expect(url).toContain("Sales.P_Contract(Contract.P_Name)");
    // Candidate's alias prefix is `Person`, not the resource name (ADR-0058).
    expect(url).toContain("Sales.P_Candidate(Person.P_Name)");
    expect(url).toContain("Sales.P_Resume(Resume.P_Name)");
  });

  it("get(id) sends a Sales.P_Id condition against /v1/sales", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_OK).get(7);
    expect(one).toBeUndefined(); // 0-item response
    expect(calls[0].req.url).toContain("https://h.test/v1/sales?");
    expect(decodeURIComponent(calls[0].req.url)).toContain("Sales.P_Id:eq=7");
  });
});
