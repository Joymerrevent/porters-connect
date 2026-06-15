import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { UserRef } from "../xml/decode";
import { createCandidateResource } from "./candidate";

// The generic Read/Write flow is unit-tested in resource.test.ts; here we pin the
// Candidate-specific catalog (each field decodes by its Field Type) and config
// (root name `Candidate`, path `candidate`, alias prefix `Person`).
const USER_FIELDS = ["P_Owner", "P_RegisteredBy", "P_UpdatedBy"];
const DATETIME_FIELDS = ["P_RegistrationDate", "P_UpdateDate", "P_PhaseDate"];
const OPTION_FIELDS = ["P_Phase"];
const TEXT_FIELDS = [
  "P_Name",
  "P_Reading",
  "P_Mail",
  "P_MobileMail",
  "P_Telephone",
  "P_Mobile",
  "P_Country",
  "P_Prefecture",
  "P_City",
  "P_Zipcode",
];

const ALL =
  `<?xml version="1.0"?><Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Person.P_Id>42</Person.P_Id>` +
  USER_FIELDS.map(
    (f, i) =>
      `<Person.${f}><User><User.P_Id>${i + 1}</User.P_Id><User.P_Name>u${i}</User.P_Name></User></Person.${f}>`,
  ).join("") +
  DATETIME_FIELDS.map(
    (f, i) => `<Person.${f}>2020/01/0${i + 1} 03:04:05</Person.${f}>`,
  ).join("") +
  OPTION_FIELDS.map(
    (f) => `<Person.${f}><OptionRoot><Opt_${f}/></OptionRoot></Person.${f}>`,
  ).join("") +
  TEXT_FIELDS.map((f) => `<Person.${f}/>`).join("") +
  `</Item></Candidate>`;

const READ_OK = `<?xml version="1.0"?><Candidate Total="0" Count="0" Start="0"><Code>0</Code></Candidate>`;
const WRITE_OK = `<?xml version="1.0"?><Candidate><Item><Id>10001</Id><Code>0</Code></Item></Candidate>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createCandidateResource({
    requester: stub(body, calls),
    host: "h.test",
    partition: 12,
  });

describe("createCandidateResource — decode catalog", () => {
  it("decodes every catalogued field by its Field Type", async () => {
    const calls: Call[] = [];
    const c = (await resource(calls, ALL).search()).items[0];

    expect(c.P_Id).toBe(42); // Id -> number
    USER_FIELDS.forEach((f, i) =>
      expect((c[f] as UserRef | null)?.P_Id).toBe(i + 1),
    ); // User -> nested ref
    DATETIME_FIELDS.forEach((f, i) =>
      expect(c[f]).toBe(`2020-01-0${i + 1}T03:04:05Z`),
    ); // DateTime -> ISO (...Z)
    OPTION_FIELDS.forEach((f) => expect(c[f]).toBe(`Opt_${f}`)); // Option -> end alias
    TEXT_FIELDS.forEach((f) => expect(c[f]).toBeNull()); // empty Text -> null (not "")
  });
});

describe("createCandidateResource — config & write", () => {
  it("create POSTs to /v1/candidate with Person-prefixed fields", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({
      P_Owner: 5,
      P_Name: "鈴木 一郎",
    });
    expect(id).toBe(10001); // assigned id from the Write response
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/candidate?partition=12");
    expect(req.body).toBe(
      "<Candidate><Item>" +
        "<Person.P_Owner>5</Person.P_Owner>" +
        "<Person.P_Name>鈴木 一郎</Person.P_Name>" +
        "<Person.P_Id>-1</Person.P_Id>" +
        "</Item></Candidate>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("get(id) sends a Person.P_Id condition against /v1/candidate", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_OK).get(7);
    expect(one).toBeUndefined(); // 0-item response
    expect(calls[0].req.url).toContain("https://h.test/v1/candidate?");
    expect(decodeURIComponent(calls[0].req.url)).toContain("Person.P_Id:eq=7");
  });
});
