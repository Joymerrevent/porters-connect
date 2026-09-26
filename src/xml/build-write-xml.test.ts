import fc from "fast-check";
import { XMLParser } from "fast-xml-parser";
import { describe, expect, it } from "vitest";

import type { DataType } from "../porters/data-type";
import { buildWriteXml } from "./build-write-xml";
import { encodeField } from "./encode-field";

const FIELDS = new Map<string, DataType>([
  ["P_Id", "System[Id]"],
  ["P_Owner", "User"],
  ["P_Name", "SinglelineText"],
  ["P_Reading", "SinglelineText"],
  ["P_PhaseDate", "DateTime"],
  ["P_Phase", "Option"],
]);

describe("buildWriteXml (ADR-0011, Write)", () => {
  it("wraps the resource / Item / prefixed fields in order", () => {
    const xml = buildWriteXml({
      resource: "Candidate",
      prefix: "Person",
      fields: FIELDS,
      items: [{ P_Owner: 5, P_Name: "鈴木 一郎", P_Id: -1 }],
    });
    expect(xml).toBe(
      "<Candidate><Item>" +
        "<Person.P_Owner>5</Person.P_Owner>" +
        "<Person.P_Name>鈴木 一郎</Person.P_Name>" +
        "<Person.P_Id>-1</Person.P_Id>" +
        "</Item></Candidate>",
    );
  });

  it("omits null / undefined fields but keeps an empty string (clears)", () => {
    const xml = buildWriteXml({
      resource: "Candidate",
      prefix: "Person",
      fields: FIELDS,
      items: [{ P_Name: "x", P_Reading: null, P_Owner: undefined, P_Id: "" }],
    });
    expect(xml).toContain("<Person.P_Name>x</Person.P_Name>");
    expect(xml).toContain("<Person.P_Id></Person.P_Id>"); // "" clears, not omits
    expect(xml).not.toContain("P_Reading"); // null -> omitted
    expect(xml).not.toContain("P_Owner"); // undefined -> omitted
  });

  it("uses the catalog Data Type (DateTime converts, not raw passthrough)", () => {
    const xml = buildWriteXml({
      resource: "Candidate",
      prefix: "Person",
      fields: FIELDS,
      items: [{ P_PhaseDate: "2020-01-02T03:04:05Z" }],
    });
    expect(xml).toContain(
      "<Person.P_PhaseDate>2020/01/02 03:04:05</Person.P_PhaseDate>",
    );
  });

  it("writes an Option field from an array of selected aliases", () => {
    const xml = buildWriteXml({
      resource: "Candidate",
      prefix: "Person",
      fields: FIELDS,
      items: [
        { P_Phase: ["P_PersonPhase_Applied", "P_PersonPhase_Screening"] },
      ],
    });
    expect(xml).toContain(
      "<Person.P_Phase><P_PersonPhase_Applied/><P_PersonPhase_Screening/></Person.P_Phase>",
    );
  });

  it("writes a System[Department] value as its id (reachable via a cast, like System[DateTime])", () => {
    // The static Write input excludes it, so only a cast gets here; it must still serialize as a
    // scalar rather than fall out of the switch as the text "undefined".
    const xml = buildWriteXml({
      resource: "Candidate",
      prefix: "Person",
      fields: new Map<string, DataType | null>([
        ["P_Dept", "System[Department]"],
      ]),
      items: [{ P_Dept: 7 }],
    });
    expect(xml).toContain("<Person.P_Dept>7</Person.P_Dept>");
  });

  it("writes a catalogued field with no Data Type (null — ADR-0056) through as Text", () => {
    // Only reachable via a cast (the static Write input excludes it), but symmetric with decode's
    // raw-string passthrough: a null type must not fall into the typed encoder and come out as
    // the text "undefined".
    const xml = buildWriteXml({
      resource: "Candidate",
      prefix: "Person",
      fields: new Map<string, DataType | null>([["P_Deleted", null]]),
      items: [{ P_Deleted: "1" }],
    });
    expect(xml).toContain("<Person.P_Deleted>1</Person.P_Deleted>");
  });

  it("falls back to escaped Text for an unknown (custom) alias", () => {
    const xml = buildWriteXml({
      resource: "Candidate",
      prefix: "Person",
      fields: FIELDS,
      items: [{ U_custom: "a<b" }],
    });
    expect(xml).toContain("<Person.U_custom>a&lt;b</Person.U_custom>");
  });

  it("emits one <Item> per record (bulk)", () => {
    const xml = buildWriteXml({
      resource: "Candidate",
      prefix: "Person",
      fields: FIELDS,
      items: [{ P_Id: -1 }, { P_Id: 10 }],
    });
    expect(xml).toBe(
      "<Candidate>" +
        "<Item><Person.P_Id>-1</Person.P_Id></Item>" +
        "<Item><Person.P_Id>10</Person.P_Id></Item>" +
        "</Candidate>",
    );
  });
});

// Property-based tests (fast-check). エスケープは「& < > を並べた 1 本の文字列」で
// 確かめているが、それだと「どんな文字列でも書いて読んだら元に戻る」という肝心の
// 不変条件は代表値の外で崩れても見えない。値を機械に選ばせて往復性を直接検査する。
describe("Write XML: 書いて読むと戻る（property-based）", () => {
  // parse-xml.ts と同じ設定。ここが食い違うと「往復した」ことにならない。
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    ignoreDeclaration: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    isArray: (name) => name === "Item",
  });

  // 素の乱文字列だけだと & < > がめったに出ず、エスケープを消しても気づけない。
  // XML で意味を持つ文字を濃く含む文字列を混ぜて、往復性の検査が実際に効くようにする。
  const xmlish = fc.string({
    unit: fc.constantFrom("&", "<", ">", '"', "'", "/", "a", "あ", "1"),
    minLength: 1,
    maxLength: 40,
  });
  // trimValues: true なので前後の空白は往復しない（パーサーの仕様であって欠陥ではない）。
  // 制御文字も XML 1.0 では表現できないため、対象から外す。
  const textValue = fc
    .oneof(xmlish, fc.string({ minLength: 1, maxLength: 60, unit: "grapheme" }))
    // eslint-disable-next-line no-control-regex
    .filter((v) => !/[\u0000-\u001f\u007f]/.test(v))
    .filter((v) => v === v.trim() && v.length > 0);

  // 往復だけだと & と > は捕まらない（fast-xml-parser は生の & / > を素通しするため、
  // エスケープを外しても読み戻せてしまう）。エスケープ契約そのものを直接検査する。
  it("エスケープ後の本文に生の & < > が残らず、戻すと元の文字列になる", () => {
    fc.assert(
      fc.property(textValue, (v) => {
        const out = encodeField("SinglelineText", v, "P_Name");
        expect(out).not.toMatch(/[<>]/);
        // 残った & は必ず既知の実体参照の先頭
        expect(out.replace(/&(amp|lt|gt);/g, "")).not.toContain("&");
        // 実体参照を戻すと元の値（&amp; を最後に戻さないと二重復号になる）
        const back = out
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");
        expect(back).toBe(v);
      }),
    );
  });

  it("任意の文字列を書いて読むと元の文字列に戻る", () => {
    fc.assert(
      fc.property(textValue, textValue, (name, memo) => {
        const xml = buildWriteXml({
          resource: "Candidate",
          prefix: "Person",
          fields: new Map<string, DataType>([
            ["P_Name", "SinglelineText"],
            ["P_Memo", "MultilineText"],
          ]),
          items: [{ P_Name: name, P_Memo: memo }],
        });
        const parsed: unknown = parser.parse(xml);
        const item = (
          parsed as { Candidate: { Item: Record<string, unknown>[] } }
        ).Candidate.Item[0];
        expect(item["Person.P_Name"]).toBe(name);
        expect(item["Person.P_Memo"]).toBe(memo);
      }),
    );
  });

  it("値に何が入っていても要素の骨格を壊さない（Item は必ず 1 件・入れ子が増えない）", () => {
    fc.assert(
      fc.property(fc.array(textValue, { minLength: 1, maxLength: 5 }), (xs) => {
        const xml = buildWriteXml({
          resource: "Candidate",
          prefix: "Person",
          fields: new Map<string, DataType>([["P_Name", "SinglelineText"]]),
          items: xs.map((v) => ({ P_Name: v })),
        });
        const parsed: unknown = parser.parse(xml);
        const items = (parsed as { Candidate: { Item: unknown[] } }).Candidate
          .Item;
        // 値に < を入れられて要素が増える／壊れることが無い＝注入されていない。
        expect(items).toHaveLength(xs.length);
        for (const [i, v] of xs.entries()) {
          expect(items[i]).toEqual({ "Person.P_Name": v });
        }
      }),
    );
  });
});
