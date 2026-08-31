import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { FieldValue, UserRef } from "../xml/decode";
import { createRecruiterResource } from "./recruiter";

// The generic Read/Write flow is unit-tested in resource.test.ts; here we pin the
// Recruiter-specific catalog (each field decodes by its Data Type) and config
// (root name `Recruiter`, path `recruiter`, alias prefix `Recruiter`).
const USER_FIELDS = ["P_Owner", "P_RegisteredBy", "P_UpdatedBy"];
const DATETIME_FIELDS = ["P_RegistrationDate", "P_UpdateDate", "P_PhaseDate"];
const OPTION_FIELDS = ["P_Phase"];
const TEXT_FIELDS = [
  "P_PhaseMemo",
  "P_Name",
  "P_Reading",
  "P_Division",
  "P_Title",
  "P_Memo",
  "P_Country",
  "P_Prefecture",
  "P_City",
  "P_Street",
  "P_Zipcode",
  "P_Telephone",
  "P_Fax",
  "P_Mail",
  "P_Mobile",
  "P_MobileMail",
];

const ALL =
  `<?xml version="1.0"?><Recruiter Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Recruiter.P_Id>42</Recruiter.P_Id>` +
  // System[Reference] reads as the referenced record's id when it is not expanded.
  `<Recruiter.P_Client><Client><Client.P_Id>77</Client.P_Id></Client></Recruiter.P_Client>` +
  USER_FIELDS.map(
    (f, i) =>
      `<Recruiter.${f}><User><User.P_Id>${i + 1}</User.P_Id><User.P_Name>u${i}</User.P_Name></User></Recruiter.${f}>`,
  ).join("") +
  DATETIME_FIELDS.map(
    (f, i) => `<Recruiter.${f}>2020/01/0${i + 1} 03:04:05</Recruiter.${f}>`,
  ).join("") +
  OPTION_FIELDS.map(
    (f) =>
      `<Recruiter.${f}><OptionRoot><Opt_${f}/></OptionRoot></Recruiter.${f}>`,
  ).join("") +
  TEXT_FIELDS.map((f) => `<Recruiter.${f}/>`).join("") +
  `</Item></Recruiter>`;

const READ_OK = `<?xml version="1.0"?><Recruiter Total="0" Count="0" Start="0"><Code>0</Code></Recruiter>`;
const WRITE_OK = `<?xml version="1.0"?><Recruiter><Item><Id>2001</Id><Code>0</Code></Item></Recruiter>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createRecruiterResource({
    requester: stub(body, calls),
    accessPoint: { host: "h.test" },
    partition: 12,
  });

describe("createRecruiterResource — decode catalog", () => {
  it("decodes every catalogued field by its Data Type", async () => {
    const calls: Call[] = [];
    const r = (await resource(calls, ALL).search()).items[0];
    // Closed ReadRecord has no string index (U1); read by-name through a loose view.
    const rec = r as Record<string, FieldValue | undefined>;

    expect(r.P_Id).toBe(42); // Id -> number
    expect(r.P_Client).toBe(77); // System[Reference] -> referenced id
    USER_FIELDS.forEach((f, i) =>
      expect((rec[f] as UserRef | null)?.P_Id).toBe(i + 1),
    ); // User -> nested ref
    DATETIME_FIELDS.forEach((f, i) =>
      expect(rec[f]).toBe(`2020-01-0${i + 1}T03:04:05Z`),
    ); // DateTime -> ISO (...Z)
    OPTION_FIELDS.forEach((f) => expect(rec[f]).toEqual([`Opt_${f}`])); // Option -> array
    TEXT_FIELDS.forEach((f) => expect(rec[f]).toBeNull()); // empty Text -> null (not "")
  });
});

describe("createRecruiterResource — config & write", () => {
  it("create POSTs to /v1/recruiter with Recruiter-prefixed fields", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({
      P_Owner: 5,
      P_Client: 77,
      P_Name: "山田 太郎",
    });
    expect(id).toBe(2001); // assigned id from the Write response
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/recruiter?partition=12");
    expect(req.body).toBe(
      "<Recruiter><Item>" +
        "<Recruiter.P_Owner>5</Recruiter.P_Owner>" +
        // System[Reference] writes as the referenced id under this resource's own alias
        // (same shape as Job / Process — see job.test.ts).
        "<Recruiter.P_Client>77</Recruiter.P_Client>" +
        "<Recruiter.P_Name>山田 太郎</Recruiter.P_Name>" +
        "<Recruiter.P_Id>-1</Recruiter.P_Id>" +
        "</Item></Recruiter>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("get(id) sends a Recruiter.P_Id condition against /v1/recruiter", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_OK).get(7);
    expect(one).toBeUndefined(); // 0-item response
    expect(calls[0].req.url).toContain("https://h.test/v1/recruiter?");
    expect(decodeURIComponent(calls[0].req.url)).toContain(
      "Recruiter.P_Id:eq=7",
    );
  });

  it("expand(P_Client) requests the Client's fields through the reference", async () => {
    const calls: Call[] = [];
    await resource(calls, READ_OK).search({
      field: ["P_Id"],
      expand: { P_Client: ["P_Name"] },
    });
    // ADR-0058: the referenced prefix comes from the descriptor, never from the caller.
    expect(decodeURIComponent(calls[0].req.url)).toContain(
      "Recruiter.P_Client(Client.P_Name)",
    );
  });
});
