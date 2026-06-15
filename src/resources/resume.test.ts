import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { UserRef } from "../xml/decode";
import { createResumeResource } from "./resume";

// The generic Read/Write flow is unit-tested in resource.test.ts; here we pin the
// Resume-specific catalog (each field decodes by its Field Type) and config
// (root name `Resume`, path `resume`, alias prefix `Resume`).
const USER_FIELDS = ["P_Owner", "P_RegisteredBy", "P_UpdatedBy"];
const REF_FIELDS = ["P_Candidate"];
const DATETIME_FIELDS = ["P_RegistrationDate", "P_UpdateDate", "P_PhaseDate"];
const OPTION_FIELDS = [
  "P_Phase",
  "P_RegisterChannel",
  "P_CurrentStatus",
  "P_ExperiencedJobCategory",
  "P_ExperiencedIndustry",
  "P_Gender",
  "P_ExpectEmploymentType",
  "P_ExpectArea",
  "P_ExpectJobCategory",
  "P_ExpectIndustry",
];
const NUMBER_FIELDS = [
  "P_CurrentSalary",
  "P_ChangeJobsCount",
  "P_ExpectSalary",
  "P_DesiredHourlyRate",
  "P_HourlyRate",
];
const AGE_FIELDS = ["P_DateOfBirth"]; // Age Field Type — wire value is yyyy/mm/dd
const TEXT_FIELDS = [
  "P_PhaseMemo",
  "P_Name",
  "P_Memo",
  "P_Education",
  "P_CarrierSummary",
  "P_ExpectCondition",
];

const ALL =
  `<?xml version="1.0"?><Resume Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Resume.P_Id>42</Resume.P_Id>` +
  USER_FIELDS.map(
    (f, i) =>
      `<Resume.${f}><User><User.P_Id>${i + 1}</User.P_Id><User.P_Name>u${i}</User.P_Name></User></Resume.${f}>`,
  ).join("") +
  REF_FIELDS.map(
    (f, i) => `<Resume.${f}><R><R.P_Id>${500 + i}</R.P_Id></R></Resume.${f}>`,
  ).join("") +
  DATETIME_FIELDS.map(
    (f, i) => `<Resume.${f}>2020/01/0${i + 1} 03:04:05</Resume.${f}>`,
  ).join("") +
  OPTION_FIELDS.map(
    (f) => `<Resume.${f}><OptionRoot><Opt_${f}/></OptionRoot></Resume.${f}>`,
  ).join("") +
  NUMBER_FIELDS.map(
    (f, i) => `<Resume.${f}>${1000 * (i + 1)}</Resume.${f}>`,
  ).join("") +
  AGE_FIELDS.map((f) => `<Resume.${f}>1990/01/02</Resume.${f}>`).join("") +
  TEXT_FIELDS.map((f) => `<Resume.${f}/>`).join("") +
  `</Item></Resume>`;

const READ_OK = `<?xml version="1.0"?><Resume Total="0" Count="0" Start="0"><Code>0</Code></Resume>`;
const WRITE_OK = `<?xml version="1.0"?><Resume><Item><Id>4001</Id><Code>0</Code></Item></Resume>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createResumeResource({
    requester: stub(body, calls),
    host: "h.test",
    partition: 12,
  });

describe("createResumeResource — decode catalog", () => {
  it("decodes every catalogued field by its Field Type", async () => {
    const calls: Call[] = [];
    const r = (await resource(calls, ALL).search()).items[0];

    expect(r.P_Id).toBe(42); // Id -> number
    USER_FIELDS.forEach((f, i) =>
      expect((r[f] as UserRef | null)?.P_Id).toBe(i + 1),
    ); // User -> nested ref
    REF_FIELDS.forEach((f, i) => expect(r[f]).toBe(500 + i)); // System[Reference] -> id
    DATETIME_FIELDS.forEach((f, i) =>
      expect(r[f]).toBe(`2020-01-0${i + 1}T03:04:05Z`),
    ); // DateTime -> ISO (...Z)
    OPTION_FIELDS.forEach((f) => expect(r[f]).toBe(`Opt_${f}`)); // Option -> end alias
    NUMBER_FIELDS.forEach((f, i) => expect(r[f]).toBe(1000 * (i + 1))); // Number / Currency
    AGE_FIELDS.forEach((f) => expect(r[f]).toBe("1990-01-02")); // Age -> yyyy-mm-dd (Date wire)
    TEXT_FIELDS.forEach((f) => expect(r[f]).toBeNull()); // empty Text -> null (not "")
  });
});

describe("createResumeResource — config & write", () => {
  it("create POSTs to /v1/resume and writes the related ids", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({
      P_Owner: 5,
      P_Candidate: 1001,
    });
    expect(id).toBe(4001); // assigned id from the Write response
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/resume?partition=12");
    expect(req.body).toBe(
      "<Resume><Item>" +
        "<Resume.P_Owner>5</Resume.P_Owner>" +
        "<Resume.P_Candidate>1001</Resume.P_Candidate>" +
        "<Resume.P_Id>-1</Resume.P_Id>" +
        "</Item></Resume>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("get(id) sends a Resume.P_Id condition against /v1/resume", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_OK).get(7);
    expect(one).toBeUndefined(); // 0-item response
    expect(calls[0].req.url).toContain("https://h.test/v1/resume?");
    expect(decodeURIComponent(calls[0].req.url)).toContain("Resume.P_Id:eq=7");
  });
});
