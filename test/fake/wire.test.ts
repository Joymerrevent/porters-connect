// The wire layer is the fake's only hard contract (ADR-0043: "XML ワイヤ形状は妥協不可"), so these
// assertions go through the library's own parser/decoder wherever possible: if what the fake emits
// stops being what `parseResourcePage` + `decodeField` eat, this fails.

import { describe, expect, it } from "vitest";

import { decoderFor } from "../../src/resources/read-core";
import { CANDIDATE_DESCRIPTOR } from "../../src/resources/candidate";
import { buildWriteXml } from "../../src/xml/encode";
import {
  parseAuthentication,
  parseResourcePage,
  parseWriteResult,
} from "../../src/xml/parser";
import { createFakeMasters } from "./masters";
import type { FakeRecord } from "./types";
import {
  buildAuthenticationXml,
  buildReadPageXml,
  buildResourceErrorXml,
  buildWriteResultXml,
  parseWriteBody,
  type FieldSelection,
} from "./wire";

const FIELDS = CANDIDATE_DESCRIPTOR.fields;
const PREFIX = CANDIDATE_DESCRIPTOR.prefix;
const fieldMap = new Map(Object.entries(FIELDS));
const decode = decoderFor(FIELDS);

const select = (...aliases: string[]): FieldSelection[] =>
  aliases.map((alias) => ({ alias, sub: [] }));

const page = (
  records: FakeRecord[],
  selection: FieldSelection[],
  masters = createFakeMasters({}),
): string =>
  buildReadPageXml({
    resource: CANDIDATE_DESCRIPTOR.name,
    shape: { prefix: PREFIX, fields: FIELDS, masters },
    records,
    selection,
    total: records.length,
    start: 0,
  });

describe("parseWriteBody", () => {
  it("parses what buildWriteXml produces, stripping the alias prefix", () => {
    const xml = buildWriteXml({
      resource: CANDIDATE_DESCRIPTOR.name,
      prefix: PREFIX,
      fields: fieldMap,
      items: [
        { P_Id: -1, P_Owner: 5, P_Name: "山田 太郎" },
        { P_Id: 10001, P_Name: "佐藤 次郎" },
      ],
    });

    expect(parseWriteBody(xml, PREFIX)).toEqual({
      resource: "Candidate",
      items: [
        { P_Id: "-1", P_Owner: "5", P_Name: "山田 太郎" },
        { P_Id: "10001", P_Name: "佐藤 次郎" },
      ],
    });
  });

  it("reads an Option field back as its selected aliases", () => {
    const xml = buildWriteXml({
      resource: "Candidate",
      prefix: PREFIX,
      fields: fieldMap,
      items: [
        { P_Id: -1, P_Phase: ["Option.P_Applied", "Option.P_Screening"] },
      ],
    });

    expect(parseWriteBody(xml, PREFIX)?.items[0]).toEqual({
      P_Id: "-1",
      P_Phase: ["Option.P_Applied", "Option.P_Screening"],
    });
  });

  it("un-escapes the values the encoder escaped", () => {
    const xml = buildWriteXml({
      resource: "Candidate",
      prefix: PREFIX,
      fields: fieldMap,
      items: [{ P_Id: -1, P_Name: "A & B <C>" }],
    });

    expect(parseWriteBody(xml, PREFIX)?.items[0]?.P_Name).toBe("A & B <C>");
  });

  it("returns undefined for a payload that is not a Write envelope", () => {
    expect(parseWriteBody("", PREFIX)).toBeUndefined();
    expect(parseWriteBody("not xml at all", PREFIX)).toBeUndefined();
  });
});

describe("buildReadPageXml", () => {
  it("builds the envelope parseResourcePage expects", () => {
    const xml = buildReadPageXml({
      resource: "Candidate",
      shape: { prefix: PREFIX, fields: FIELDS, masters: createFakeMasters({}) },
      records: [{ P_Id: "10001" }, { P_Id: "10002" }],
      selection: select("P_Id"),
      total: 7,
      start: 4,
    });

    expect(parseResourcePage(xml)).toEqual({
      total: 7,
      count: 2,
      start: 4,
      items: [{ "Person.P_Id": "10001" }, { "Person.P_Id": "10002" }],
    });
  });

  it("expands a User field through the master and decodes back to a UserRef", () => {
    const masters = createFakeMasters({
      users: [{ P_Id: 5, P_Name: "採用 花子", P_Mail: "hanako@example.com" }],
    });
    const xml = page(
      [{ P_Id: "10001", P_Owner: "5" }],
      select("P_Owner"),
      masters,
    );

    const decoded = decode(parseResourcePage(xml).items[0]);
    expect(decoded.P_Owner).toEqual({
      P_Id: 5,
      P_Type: "0",
      P_Name: "採用 花子",
      P_Mail: "hanako@example.com",
    });
  });

  it("honours a narrowed User sub-selection", () => {
    const xml = page(
      [{ P_Id: "10001", P_Owner: "5" }],
      [{ alias: "P_Owner", sub: ["User.P_Id", "User.P_Name"] }],
    );

    expect(xml).toContain("<User.P_Id>5</User.P_Id>");
    expect(xml).not.toContain("User.P_Mail");
  });

  it("wraps Option aliases in OptionRoot and round-trips the selection", () => {
    const xml = page(
      [{ P_Id: "10001", P_Phase: ["Option.P_Applied", "Option.P_Screening"] }],
      select("P_Phase"),
    );

    expect(xml).toContain("<OptionRoot>");
    expect(decode(parseResourcePage(xml).items[0]).P_Phase).toEqual([
      "Option.P_Applied",
      "Option.P_Screening",
    ]);
  });

  it("emits a requested-but-unset field as an empty element (decodes to null)", () => {
    const xml = page([{ P_Id: "10001" }], select("P_Id", "P_Mail"));

    expect(xml).toContain("<Person.P_Mail />");
    expect(decode(parseResourcePage(xml).items[0]).P_Mail).toBeNull();
  });

  it("escapes values so the parser sees them verbatim", () => {
    const xml = page(
      [{ P_Id: "10001", P_Name: "A & B <C>" }],
      select("P_Name"),
    );

    expect(decode(parseResourcePage(xml).items[0]).P_Name).toBe("A & B <C>");
  });
});

describe("buildWriteResultXml / error envelopes", () => {
  it("returns one result item per record, in order", () => {
    const xml = buildWriteResultXml("Candidate", [
      { id: 10001, code: 0 },
      { id: 0, code: 133 },
    ]);

    expect(parseWriteResult(xml)).toEqual([
      { id: 10001, code: 0 },
      { id: 0, code: 133 },
    ]);
  });

  it("routes a Resource error envelope to the mapped PortersError", () => {
    const xml = buildResourceErrorXml("Candidate", 403, "No permission");

    expect(() => parseResourcePage(xml)).toThrow(
      expect.objectContaining({
        name: "PortersResourceError",
        code: 403,
        category: "permission",
      }),
    );
  });

  it("builds an Authentication envelope the auth parser understands", () => {
    const ok = buildAuthenticationXml({ Code: "abc", Error: "0" });
    expect(parseAuthentication(ok).code).toBe("abc");

    const failed = buildAuthenticationXml({
      Error: "103",
      Message: "bad code",
    });
    expect(() => parseAuthentication(failed)).toThrow(
      expect.objectContaining({ name: "PortersAuthError", code: 103 }),
    );
  });
});
