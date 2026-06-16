import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { UserRef } from "../xml/decode";
import { createProcessResource } from "./process";

// The generic Read/Write flow is unit-tested in resource.test.ts; here we pin the
// Process-specific catalog (each field decodes by its Data Type) and config
// (root name `Process`, path `process`, alias prefix `Process`).
const USER_FIELDS = ["P_Owner", "P_RegisteredBy", "P_UpdatedBy"];
const REF_FIELDS = [
  "P_Client",
  "P_Recruiter",
  "P_Job",
  "P_Candidate",
  "P_Resume",
];
const DATETIME_FIELDS = ["P_RegistrationDate", "P_UpdateDate", "P_PhaseDate"];
const OPTION_FIELDS = ["P_Phase", "P_Close", "P_CloseReason"];
const NUMBER_FIELDS = ["P_ExpectedSalesAmount"];
const DATE_FIELDS = ["P_ExpectedClosingDate"];
const TEXT_FIELDS = ["P_PhaseMemo"];

const ALL =
  `<?xml version="1.0"?><Process Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Process.P_Id>42</Process.P_Id>` +
  USER_FIELDS.map(
    (f, i) =>
      `<Process.${f}><User><User.P_Id>${i + 1}</User.P_Id><User.P_Name>u${i}</User.P_Name></User></Process.${f}>`,
  ).join("") +
  REF_FIELDS.map(
    (f, i) => `<Process.${f}><R><R.P_Id>${500 + i}</R.P_Id></R></Process.${f}>`,
  ).join("") +
  DATETIME_FIELDS.map(
    (f, i) => `<Process.${f}>2020/01/0${i + 1} 03:04:05</Process.${f}>`,
  ).join("") +
  OPTION_FIELDS.map(
    (f) => `<Process.${f}><OptionRoot><Opt_${f}/></OptionRoot></Process.${f}>`,
  ).join("") +
  NUMBER_FIELDS.map((f) => `<Process.${f}>3000000</Process.${f}>`).join("") +
  DATE_FIELDS.map((f) => `<Process.${f}>2025/06/07</Process.${f}>`).join("") +
  TEXT_FIELDS.map((f) => `<Process.${f}/>`).join("") +
  `</Item></Process>`;

const READ_OK = `<?xml version="1.0"?><Process Total="0" Count="0" Start="0"><Code>0</Code></Process>`;
const WRITE_OK = `<?xml version="1.0"?><Process><Item><Id>3001</Id><Code>0</Code></Item></Process>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createProcessResource({
    requester: stub(body, calls),
    host: "h.test",
    partition: 12,
  });

describe("createProcessResource — decode catalog", () => {
  it("decodes every catalogued field by its Data Type", async () => {
    const calls: Call[] = [];
    const p = (await resource(calls, ALL).search()).items[0];

    expect(p.P_Id).toBe(42); // Id -> number
    USER_FIELDS.forEach((f, i) =>
      expect((p[f] as UserRef | null)?.P_Id).toBe(i + 1),
    ); // User -> nested ref
    REF_FIELDS.forEach((f, i) => expect(p[f]).toBe(500 + i)); // System[Reference] -> id
    DATETIME_FIELDS.forEach((f, i) =>
      expect(p[f]).toBe(`2020-01-0${i + 1}T03:04:05Z`),
    ); // DateTime -> ISO (...Z)
    OPTION_FIELDS.forEach((f) => expect(p[f]).toEqual([`Opt_${f}`])); // Option -> array
    NUMBER_FIELDS.forEach((f) => expect(p[f]).toBe(3000000)); // Currency -> number
    DATE_FIELDS.forEach((f) => expect(p[f]).toBe("2025-06-07")); // Date -> yyyy-mm-dd
    TEXT_FIELDS.forEach((f) => expect(p[f]).toBeNull()); // empty Text -> null (not "")
  });
});

describe("createProcessResource — config & write", () => {
  it("create POSTs to /v1/process and writes the related ids", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({
      P_Owner: 1,
      P_Client: 10,
      P_Recruiter: 20,
      P_Job: 30,
      P_Candidate: 40,
      P_Resume: 50,
    });
    expect(id).toBe(3001); // assigned id from the Write response
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/process?partition=12");
    expect(req.body).toBe(
      "<Process><Item>" +
        "<Process.P_Owner>1</Process.P_Owner>" +
        "<Process.P_Client>10</Process.P_Client>" +
        "<Process.P_Recruiter>20</Process.P_Recruiter>" +
        "<Process.P_Job>30</Process.P_Job>" +
        "<Process.P_Candidate>40</Process.P_Candidate>" +
        "<Process.P_Resume>50</Process.P_Resume>" +
        "<Process.P_Id>-1</Process.P_Id>" +
        "</Item></Process>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("get(id) sends a Process.P_Id condition against /v1/process", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_OK).get(7);
    expect(one).toBeUndefined(); // 0-item response
    expect(calls[0].req.url).toContain("https://h.test/v1/process?");
    expect(decodeURIComponent(calls[0].req.url)).toContain("Process.P_Id:eq=7");
  });
});
