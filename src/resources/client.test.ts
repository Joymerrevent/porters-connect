import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { FieldValue, UserRef } from "../xml/decode";
import { createClientResource } from "./client";

// The generic Read/Write flow is unit-tested in resource.test.ts; here we pin the
// Client-specific catalog (each field decodes by its Data Type) and config
// (root name `Client`, path `client`, alias prefix `Client`).
const USER_FIELDS = ["P_Owner", "P_RegisteredBy", "P_UpdatedBy"];
const DATETIME_FIELDS = ["P_RegistrationDate", "P_UpdateDate", "P_PhaseDate"];
const OPTION_FIELDS = ["P_Phase"];
const TEXT_FIELDS = [
  "P_PhaseMemo",
  "P_Name",
  "P_Memo",
  "P_Country",
  "P_Prefecture",
  "P_City",
  "P_Street",
  "P_Zipcode",
  "P_Telephone",
  "P_Fax",
];

const ALL =
  `<?xml version="1.0"?><Client Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Client.P_Id>42</Client.P_Id>` +
  USER_FIELDS.map(
    (f, i) =>
      `<Client.${f}><User><User.P_Id>${i + 1}</User.P_Id><User.P_Name>u${i}</User.P_Name></User></Client.${f}>`,
  ).join("") +
  DATETIME_FIELDS.map(
    (f, i) => `<Client.${f}>2020/01/0${i + 1} 03:04:05</Client.${f}>`,
  ).join("") +
  OPTION_FIELDS.map(
    (f) => `<Client.${f}><OptionRoot><Opt_${f}/></OptionRoot></Client.${f}>`,
  ).join("") +
  TEXT_FIELDS.map((f) => `<Client.${f}/>`).join("") +
  `</Item></Client>`;

const READ_OK = `<?xml version="1.0"?><Client Total="0" Count="0" Start="0"><Code>0</Code></Client>`;
const WRITE_OK = `<?xml version="1.0"?><Client><Item><Id>2001</Id><Code>0</Code></Item></Client>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createClientResource({
    requester: stub(body, calls),
    host: "h.test",
    partition: 12,
  });

describe("createClientResource — decode catalog", () => {
  it("decodes every catalogued field by its Data Type", async () => {
    const calls: Call[] = [];
    const c = (await resource(calls, ALL).search()).items[0];
    // Closed ReadRecord has no string index (U1); read by-name through a loose view.
    const rec = c as Record<string, FieldValue | undefined>;

    expect(c.P_Id).toBe(42); // Id -> number
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

describe("createClientResource — config & write", () => {
  it("create POSTs to /v1/client with Client-prefixed fields", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({
      P_Owner: 5,
      P_Name: "Acme Inc",
    });
    expect(id).toBe(2001); // assigned id from the Write response
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/client?partition=12");
    expect(req.body).toBe(
      "<Client><Item>" +
        "<Client.P_Owner>5</Client.P_Owner>" +
        "<Client.P_Name>Acme Inc</Client.P_Name>" +
        "<Client.P_Id>-1</Client.P_Id>" +
        "</Item></Client>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("get(id) sends a Client.P_Id condition against /v1/client", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_OK).get(7);
    expect(one).toBeUndefined(); // 0-item response
    expect(calls[0].req.url).toContain("https://h.test/v1/client?");
    expect(decodeURIComponent(calls[0].req.url)).toContain("Client.P_Id:eq=7");
  });
});
