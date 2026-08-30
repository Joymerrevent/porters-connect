import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { FieldValue, UserRef } from "../xml/decode";
import { CONTACT_DESCRIPTOR, createContactResource } from "./contact";
import { RECRUITER_DESCRIPTOR } from "./recruiter";

// The generic Read/Write flow is unit-tested in resource.test.ts; here we pin the
// Contact-specific catalog (each field decodes by its Data Type) and config
// (root name `Contact`, path `contact`, alias prefix `Contact`).
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
  `<?xml version="1.0"?><Contact Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Contact.P_Id>42</Contact.P_Id>` +
  // System[Reference] reads as the referenced record's id when it is not expanded.
  `<Contact.P_Client><Client><Client.P_Id>77</Client.P_Id></Client></Contact.P_Client>` +
  USER_FIELDS.map(
    (f, i) =>
      `<Contact.${f}><User><User.P_Id>${i + 1}</User.P_Id><User.P_Name>u${i}</User.P_Name></User></Contact.${f}>`,
  ).join("") +
  DATETIME_FIELDS.map(
    (f, i) => `<Contact.${f}>2020/01/0${i + 1} 03:04:05</Contact.${f}>`,
  ).join("") +
  OPTION_FIELDS.map(
    (f) => `<Contact.${f}><OptionRoot><Opt_${f}/></OptionRoot></Contact.${f}>`,
  ).join("") +
  TEXT_FIELDS.map((f) => `<Contact.${f}/>`).join("") +
  `</Item></Contact>`;

const READ_OK = `<?xml version="1.0"?><Contact Total="0" Count="0" Start="0"><Code>0</Code></Contact>`;
const WRITE_OK = `<?xml version="1.0"?><Contact><Item><Id>2001</Id><Code>0</Code></Item></Contact>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createContactResource({
    requester: stub(body, calls),
    accessPoint: { host: "h.test" },
    partition: 12,
  });

describe("createContactResource — decode catalog", () => {
  it("decodes every catalogued field by its Data Type", async () => {
    const calls: Call[] = [];
    const c = (await resource(calls, ALL).search()).items[0];
    // Closed ReadRecord has no string index (U1); read by-name through a loose view.
    const rec = c as Record<string, FieldValue | undefined>;

    expect(c.P_Id).toBe(42); // Id -> number
    expect(c.P_Client).toBe(77); // System[Reference] -> referenced id
    USER_FIELDS.forEach((f, i) =>
      expect((rec[f] as UserRef | null)?.P_Id).toBe(i + 1),
    ); // User -> nested ref
    DATETIME_FIELDS.forEach((f, i) =>
      expect(rec[f]).toBe(`2020-01-0${i + 1}T03:04:05Z`),
    ); // DateTime -> ISO (...Z)
    OPTION_FIELDS.forEach((f) => expect(rec[f]).toEqual([`Opt_${f}`])); // Option -> array
    TEXT_FIELDS.forEach((f) => expect(rec[f]).toBeNull()); // empty Text -> null (not "")
  });

  it("carries the same field list as Recruiter, under its own prefix", () => {
    // PORTERS gives the two roles identical fields. Keeping that fact in a test means a future
    // divergence in docs/reference surfaces here instead of silently in one catalog.
    expect(Object.keys(CONTACT_DESCRIPTOR.fields)).toEqual(
      Object.keys(RECRUITER_DESCRIPTOR.fields),
    );
    expect(CONTACT_DESCRIPTOR.prefix).toBe("Contact");
    expect(RECRUITER_DESCRIPTOR.prefix).toBe("Recruiter");
  });
});

describe("createContactResource — config & write", () => {
  it("create POSTs to /v1/contact with Contact-prefixed fields", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({
      P_Owner: 5,
      P_Client: 77,
      P_Name: "問合 花子",
    });
    expect(id).toBe(2001); // assigned id from the Write response
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/contact?partition=12");
    expect(req.body).toBe(
      "<Contact><Item>" +
        "<Contact.P_Owner>5</Contact.P_Owner>" +
        "<Contact.P_Client>77</Contact.P_Client>" +
        "<Contact.P_Name>問合 花子</Contact.P_Name>" +
        "<Contact.P_Id>-1</Contact.P_Id>" +
        "</Item></Contact>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("get(id) sends a Contact.P_Id condition against /v1/contact", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_OK).get(7);
    expect(one).toBeUndefined(); // 0-item response
    expect(calls[0].req.url).toContain("https://h.test/v1/contact?");
    expect(decodeURIComponent(calls[0].req.url)).toContain("Contact.P_Id:eq=7");
  });

  it("expand(P_Client) requests the Client's fields through the reference", async () => {
    const calls: Call[] = [];
    await resource(calls, READ_OK).search({
      field: ["P_Id"],
      expand: { P_Client: ["P_Name"] },
    });
    // ADR-0058: the referenced prefix comes from the descriptor, never from the caller.
    expect(decodeURIComponent(calls[0].req.url)).toContain(
      "Contact.P_Client(Client.P_Name)",
    );
  });
});
