import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { UserRef } from "../xml/decode";
import { createJobResource } from "./job";

// Catalogued fields grouped by Data Type. Each group decodes differently from raw
// passthrough, so observing every field pins its catalog entry (mutation coverage).
const USER_FIELDS = ["P_Owner", "P_RegisteredBy", "P_UpdatedBy"];
const REF_FIELDS = ["P_Client", "P_Recruiter"];
const DATETIME_FIELDS = ["P_RegistrationDate", "P_UpdateDate", "P_PhaseDate"];
const OPTION_FIELDS = [
  "P_Phase",
  "P_Publish",
  "P_JobCategory",
  "P_Industry",
  "P_Area",
  "P_PubliclyTraded",
  "P_EmploymentType",
  "P_ExpectedAgeReason",
];
const NUMBER_FIELDS = ["P_MinSalary", "P_MaxSalary"];
const TEXT_FIELDS = [
  "P_PhaseMemo",
  "P_Position",
  "P_JobCategorySummary",
  "P_IndustrySummary",
  "P_SalarySummary",
  "P_AreaSummary",
  "P_PayrollsText",
  "P_Memo",
  "P_EmploymentPeriod",
  "P_WokingHours",
  "P_Holidays",
  "P_Benefits",
  "P_SalesAmountText",
  "P_EstablishmentDateText",
  "P_CapitalText",
];

const ALL =
  `<?xml version="1.0"?><Job Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Job.P_Id>42</Job.P_Id>` +
  USER_FIELDS.map(
    (f, i) =>
      `<Job.${f}><User><User.P_Id>${i + 1}</User.P_Id><User.P_Name>u${i}</User.P_Name></User></Job.${f}>`,
  ).join("") +
  REF_FIELDS.map(
    (f, i) => `<Job.${f}><R><R.P_Id>${500 + i}</R.P_Id></R></Job.${f}>`,
  ).join("") +
  DATETIME_FIELDS.map(
    (f, i) => `<Job.${f}>2020/01/0${i + 1} 03:04:05</Job.${f}>`,
  ).join("") +
  OPTION_FIELDS.map(
    (f) => `<Job.${f}><OptionRoot><Opt_${f}/></OptionRoot></Job.${f}>`,
  ).join("") +
  NUMBER_FIELDS.map((f, i) => `<Job.${f}>${1000 * (i + 1)}</Job.${f}>`).join(
    "",
  ) +
  TEXT_FIELDS.map((f) => `<Job.${f}/>`).join("") +
  `</Item></Job>`;

const READ_OK = `<?xml version="1.0"?><Job Total="0" Count="0" Start="0"><Code>0</Code></Job>`;
const WRITE_OK = `<?xml version="1.0"?><Job><Item><Id>900</Id><Code>0</Code></Item></Job>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createJobResource({
    requester: stub(body, calls),
    host: "h.test",
    partition: 7,
  });

describe("createJobResource — decode catalog", () => {
  it("decodes every catalogued field by its Data Type", async () => {
    const calls: Call[] = [];
    const job = (await resource(calls, ALL).search()).items[0];

    expect(job.P_Id).toBe(42); // Id -> number
    USER_FIELDS.forEach((f, i) =>
      expect((job[f] as UserRef | null)?.P_Id).toBe(i + 1),
    ); // User -> nested ref
    REF_FIELDS.forEach((f, i) => expect(job[f]).toBe(500 + i)); // System[Reference] -> id
    DATETIME_FIELDS.forEach((f, i) =>
      expect(job[f]).toBe(`2020-01-0${i + 1}T03:04:05Z`),
    ); // DateTime -> ISO (...Z)
    OPTION_FIELDS.forEach((f) => expect(job[f]).toEqual([`Opt_${f}`])); // Option -> array
    NUMBER_FIELDS.forEach((f, i) => expect(job[f]).toBe(1000 * (i + 1))); // Number
    TEXT_FIELDS.forEach((f) => expect(job[f]).toBeNull()); // empty Text -> null (not "")
  });
});

describe("createJobResource — config & write", () => {
  it("create POSTs to /v1/job and writes User/Reference fields as IDs", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({
      P_Owner: 1,
      P_Client: 500,
      P_Recruiter: 600,
      P_Position: "Engineer",
    });
    expect(id).toBe(900); // assigned id from the Write response
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/job?partition=7");
    expect(req.body).toBe(
      "<Job><Item>" +
        "<Job.P_Owner>1</Job.P_Owner>" +
        "<Job.P_Client>500</Job.P_Client>" +
        "<Job.P_Recruiter>600</Job.P_Recruiter>" +
        "<Job.P_Position>Engineer</Job.P_Position>" +
        "<Job.P_Id>-1</Job.P_Id>" +
        "</Item></Job>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("get(id) sends a Job.P_Id condition against /v1/job", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_OK).get(7);
    expect(one).toBeUndefined(); // 0-item response
    expect(calls[0].req.url).toContain("https://h.test/v1/job?");
    expect(decodeURIComponent(calls[0].req.url)).toContain("Job.P_Id:eq=7");
  });
});
