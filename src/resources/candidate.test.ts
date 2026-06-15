import { describe, expect, it } from "vitest";

import { PortersResourceError } from "../errors";
import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { UserRef } from "../xml/decode";
import { createCandidateResource } from "./candidate";

const OK_PAGE = `<?xml version="1.0"?><Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item><Person.P_Id>7</Person.P_Id><Person.U_score>42</Person.U_score></Item></Candidate>`;

// 1 Item touching every catalogued P_ field that the E2E fixture does not cover,
// each with a value that distinguishes its Field-Type decode from raw passthrough:
// DateTime/User decode differs from the raw value; empty Text -> null (vs "").
const ALL_FIELDS =
  `<?xml version="1.0"?><Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Person.P_RegistrationDate>2020/01/02 03:04:05</Person.P_RegistrationDate>` +
  `<Person.P_PhaseDate>2021/06/07 08:09:10</Person.P_PhaseDate>` +
  `<Person.P_RegisteredBy><User><User.P_Id>1</User.P_Id><User.P_Name>reg</User.P_Name></User></Person.P_RegisteredBy>` +
  `<Person.P_UpdatedBy><User><User.P_Id>2</User.P_Id><User.P_Name>upd</User.P_Name></User></Person.P_UpdatedBy>` +
  `<Person.P_Name/><Person.P_Reading/><Person.P_MobileMail/><Person.P_Telephone/>` +
  `<Person.P_Mobile/><Person.P_Country/><Person.P_Prefecture/><Person.P_City/><Person.P_Zipcode/>` +
  `</Item></Candidate>`;

const EMPTY_TEXT_FIELDS = [
  "P_Name",
  "P_Reading",
  "P_MobileMail",
  "P_Telephone",
  "P_Mobile",
  "P_Country",
  "P_Prefecture",
  "P_City",
  "P_Zipcode",
] as const;

const stubRequester = (
  body: string,
  captured: TransportRequest[],
): Requester => ({
  request: (req, parse) => {
    captured.push(req);
    return Promise.resolve(parse(body));
  },
});

const resource = (sent: TransportRequest[], body = OK_PAGE) =>
  createCandidateResource({
    requester: stubRequester(body, sent),
    host: "h.test",
    partition: 12,
  });

describe("createCandidateResource", () => {
  it("builds the read URL with partition / field / count / start", async () => {
    const sent: TransportRequest[] = [];
    await resource(sent).search({
      field: ["P_Id", "P_Name"],
      count: 50,
      start: 100,
    });
    const url = sent[0]?.url ?? "";
    expect(sent[0]?.method).toBe("GET");
    expect(url).toContain("https://h.test/v1/candidate?");
    expect(url).toContain("partition=12");
    expect(url).toContain("field=P_Id%2CP_Name");
    expect(url).toContain("count=50");
    expect(url).toContain("start=100");
  });

  it("decodes known P_ fields and passes unknown aliases through (not dropped)", async () => {
    const sent: TransportRequest[] = [];
    const page = await resource(sent).search();
    expect(page.items[0]?.P_Id).toBe(7); // Id -> number
    expect(page.items[0]?.U_score).toBe("42"); // unknown alias -> raw string
  });

  it("get(id) sends a Person.P_Id condition", async () => {
    const sent: TransportRequest[] = [];
    await resource(sent).get(7);
    const url = sent[0]?.url ?? "";
    expect(url).toContain("condition="); // param name, not the value, is "condition"
    expect(decodeURIComponent(url)).toContain("Person.P_Id:eq=7");
  });

  it("joins multiple conditions with a comma", async () => {
    const sent: TransportRequest[] = [];
    await resource(sent).search({
      condition: { "Person.P_Id:eq": "1", "Person.P_Name:part": "x" },
    });
    const url = decodeURIComponent(sent[0]?.url ?? "");
    expect(url).toContain("condition=Person.P_Id:eq=1,Person.P_Name:part=x");
  });

  it("decodes a nested (non-string) unknown alias as null", async () => {
    const body = `<Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item><Person.U_obj><x>1</x></Person.U_obj></Item></Candidate>`;
    const sent: TransportRequest[] = [];
    const page = await resource(sent, body).search({
      condition: { "Person.P_Name:part": "y" },
    });
    expect(page.items[0]?.U_obj).toBeNull();
  });

  it("omits empty condition / field objects from the URL", async () => {
    const sent: TransportRequest[] = [];
    await resource(sent).search({ condition: {}, field: [] });
    const url = sent[0]?.url ?? "";
    expect(url).not.toContain("condition=");
    expect(url).not.toContain("field=");
  });

  it("omits count / start when undefined", async () => {
    const sent: TransportRequest[] = [];
    await resource(sent).search();
    const url = sent[0]?.url ?? "";
    expect(url).not.toContain("count=");
    expect(url).not.toContain("start=");
  });

  it("decodes every catalogued P_ field by its Field Type", async () => {
    const sent: TransportRequest[] = [];
    const c = (await resource(sent, ALL_FIELDS).search()).items[0];
    // DateTime -> ISO (UTC, ...Z)
    expect(c?.P_RegistrationDate).toBe("2020-01-02T03:04:05Z");
    expect(c?.P_PhaseDate).toBe("2021-06-07T08:09:10Z");
    // User -> nested object (raw passthrough would yield null for a non-string)
    expect((c?.P_RegisteredBy as UserRef | null)?.P_Name).toBe("reg");
    expect((c?.P_UpdatedBy as UserRef | null)?.P_Name).toBe("upd");
    // empty Text -> null (raw passthrough would yield "")
    for (const key of EMPTY_TEXT_FIELDS) expect(c?.[key]).toBeNull();
  });
});

const WRITE_OK = (id = 10001) =>
  `<?xml version="1.0"?><Candidate><Item><Id>${id}</Id><Code>0</Code></Item></Candidate>`;

type WriteCall = { req: TransportRequest; spec?: RequestSpec };

const writeStub = (body: string, calls: WriteCall[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const writeResource = (calls: WriteCall[], body = WRITE_OK()) =>
  createCandidateResource({
    requester: writeStub(body, calls),
    host: "h.test",
    partition: 12,
  });

describe("createCandidateResource — Write", () => {
  it("create POSTs to the partitioned URL with a non-idempotent spec", async () => {
    const calls: WriteCall[] = [];
    const id = await writeResource(calls).create({
      P_Owner: 5,
      P_Name: "鈴木 一郎",
    });
    expect(id).toBe(10001); // resolves to the assigned id
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/candidate?partition=12");
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("create serializes the input and forces Person.P_Id=-1", async () => {
    const calls: WriteCall[] = [];
    // a caller-supplied P_Id must not override the -1 marker (value is forced,
    // regardless of where the key sits in the input)
    await writeResource(calls).create({ P_Id: 999, P_Name: "x" });
    expect(calls[0].req.body).toBe(
      "<Candidate><Item>" +
        "<Person.P_Id>-1</Person.P_Id>" +
        "<Person.P_Name>x</Person.P_Name>" +
        "</Item></Candidate>",
    );
  });

  it("update forces the target id and is idempotent", async () => {
    const calls: WriteCall[] = [];
    const id = await writeResource(calls, WRITE_OK(7)).update(7, {
      P_Name: "new",
    });
    expect(id).toBe(7);
    expect(calls[0].req.body).toContain("<Person.P_Id>7</Person.P_Id>");
    expect(calls[0].spec).toEqual({ write: true, idempotent: true });
  });

  it("maps a non-zero per-Item Code to a PortersResourceError", async () => {
    const calls: WriteCall[] = [];
    const body = `<Candidate><Item><Id>0</Id><Code>403</Code></Item></Candidate>`;
    let err: unknown;
    try {
      await writeResource(calls, body).create({ P_Name: "x" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).code).toBe(403);
    expect((err as PortersResourceError).category).toBe("permission");
    expect((err as PortersResourceError).message).toBe(
      "candidate write returned code 403",
    );
    expect((err as PortersResourceError).context?.resource).toBe("Candidate");
  });

  it("throws when the Write response carries no result Item", async () => {
    const calls: WriteCall[] = [];
    const body = `<Candidate><Other>x</Other></Candidate>`;
    let err: unknown;
    try {
      await writeResource(calls, body).create({ P_Name: "x" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).category).toBe("unknown");
    expect((err as PortersResourceError).message).toBe(
      "write returned no result item",
    );
  });
});
