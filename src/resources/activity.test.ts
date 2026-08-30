import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { FieldValue, UserRef } from "../xml/decode";
import { ACTIVITY_DESCRIPTOR, createActivityResource } from "./activity";

// The generic Read/Write flow is unit-tested in resource.test.ts; here we pin the
// Activity-specific catalog (each field decodes by its Data Type) and config
// (root name `Activity`, path `activity`, alias prefix `Activity`).
const USER_FIELDS = [
  "P_Owner",
  "P_RegisteredBy",
  "P_UpdatedBy",
  "P_EventParticipants",
];
const DATETIME_FIELDS = [
  "P_RegistrationDate",
  "P_UpdateDate",
  "P_PhaseDate",
  "P_FromDate",
  "P_ToDate",
];
const OPTION_FIELDS = ["P_Phase", "P_EventResources"];
const TEXT_FIELDS = ["P_PhaseMemo", "P_Title", "P_Memo"];

const ALL =
  `<?xml version="1.0"?><Activity Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Activity.P_Id>42</Activity.P_Id>` +
  `<Activity.P_Resource>1</Activity.P_Resource>` +
  `<Activity.P_ResourceId><Person><Person.P_Id>10001</Person.P_Id></Person></Activity.P_ResourceId>` +
  USER_FIELDS.map(
    (f, i) =>
      `<Activity.${f}><User><User.P_Id>${i + 1}</User.P_Id></User></Activity.${f}>`,
  ).join("") +
  DATETIME_FIELDS.map(
    (f, i) => `<Activity.${f}>2020/01/0${i + 1} 03:04:05</Activity.${f}>`,
  ).join("") +
  OPTION_FIELDS.map(
    (f) =>
      `<Activity.${f}><OptionRoot><Opt_${f}/></OptionRoot></Activity.${f}>`,
  ).join("") +
  TEXT_FIELDS.map((f) => `<Activity.${f}/>`).join("") +
  `</Item></Activity>`;

const READ_OK = `<?xml version="1.0"?><Activity Total="0" Count="0" Start="0"><Code>0</Code></Activity>`;
const WRITE_OK = `<?xml version="1.0"?><Activity><Item><Id>2001</Id><Code>0</Code></Item></Activity>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createActivityResource({
    requester: stub(body, calls),
    accessPoint: { host: "h.test" },
    partition: 12,
  });

describe("createActivityResource — decode catalog", () => {
  it("decodes every catalogued field by its Data Type", async () => {
    const calls: Call[] = [];
    const a = (await resource(calls, ALL).search()).items[0];
    // Closed ReadRecord has no string index (U1); read by-name through a loose view.
    const rec = a as Record<string, FieldValue | undefined>;

    expect(a.P_Id).toBe(42); // Id -> number
    expect(a.P_Resource).toBe(1); // Number -> number (Resource List id: Candidate)
    USER_FIELDS.forEach((f, i) =>
      expect((rec[f] as UserRef | null)?.P_Id).toBe(i + 1),
    ); // User -> nested ref
    DATETIME_FIELDS.forEach((f, i) =>
      expect(rec[f]).toBe(`2020-01-0${i + 1}T03:04:05Z`),
    ); // DateTime -> ISO (...Z)
    OPTION_FIELDS.forEach((f) => expect(rec[f]).toEqual([`Opt_${f}`])); // Option -> array
    TEXT_FIELDS.forEach((f) => expect(rec[f]).toBeNull()); // empty Text -> null (not "")
  });

  it("reads the polymorphic P_ResourceId as the referenced id, whatever it points at", async () => {
    const calls: Call[] = [];
    const a = (await resource(calls, ALL).search()).items[0];
    // The nested element is <Person> here because P_Resource is 1 (Candidate). Decoding does
    // not depend on that tag name, so the same field works for every target resource.
    expect(a.P_ResourceId).toBe(10001);
  });

  it("registers no expandable reference (the target is a runtime value)", () => {
    // Which catalog would decode P_ResourceId depends on P_Resource, so there is no static
    // answer. Leaving `references` unset keeps `expand` from offering a wrong one.
    expect("references" in ACTIVITY_DESCRIPTOR).toBe(false);
  });
});

describe("createActivityResource — config & write", () => {
  it("create POSTs to /v1/activity with Activity-prefixed fields", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({
      P_Owner: 5,
      P_Title: "訪問",
      P_Resource: 5,
      P_ResourceId: 20001,
    });
    expect(id).toBe(2001); // assigned id from the Write response
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/activity?partition=12");
    expect(req.body).toBe(
      "<Activity><Item>" +
        "<Activity.P_Owner>5</Activity.P_Owner>" +
        "<Activity.P_Title>訪問</Activity.P_Title>" +
        "<Activity.P_Resource>5</Activity.P_Resource>" +
        "<Activity.P_ResourceId>20001</Activity.P_ResourceId>" +
        "<Activity.P_Id>-1</Activity.P_Id>" +
        "</Item></Activity>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("get(id) sends an Activity.P_Id condition against /v1/activity", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_OK).get(7);
    expect(one).toBeUndefined(); // 0-item response
    expect(calls[0].req.url).toContain("https://h.test/v1/activity?");
    expect(decodeURIComponent(calls[0].req.url)).toContain(
      "Activity.P_Id:eq=7",
    );
  });
});
