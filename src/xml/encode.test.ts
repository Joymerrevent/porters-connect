import fc from "fast-check";
import { XMLParser } from "fast-xml-parser";
import { describe, expect, it } from "vitest";

import { PortersConfigError, PortersError } from "../errors/index";

import type { DataType } from "./decode";
import { buildWriteXml, encodeField } from "./encode";

const FIELDS = new Map<string, DataType>([
  ["P_Id", "System[Id]"],
  ["P_Owner", "User"],
  ["P_Name", "SinglelineText"],
  ["P_Reading", "SinglelineText"],
  ["P_PhaseDate", "DateTime"],
  ["P_Phase", "Option"],
]);
// `encodeField` takes the field's alias so an unconvertible value can name it (RV-36). These
// tests are about the encoding, so they pass a stand-in; the failure tests pass a real one.
const enc = (
  type: Parameters<typeof encodeField>[0],
  value: Parameters<typeof encodeField>[1],
  alias = "P_Field",
): string => encodeField(type, value, alias);

describe("encodeField (ADR-0011, Write)", () => {
  it("keeps string Data Types as-is but escapes & < >", () => {
    const stringTypes = [
      "SinglelineText",
      "MultilineText",
      "Mail",
      "Telephone",
      "URL",
    ] as const;
    for (const t of stringTypes) {
      expect(enc(t, "a&b<c>d")).toBe("a&amp;b&lt;c&gt;d");
    }
    expect(enc("MultilineText", "山田 太郎")).toBe("山田 太郎");
  });

  it("serializes System[Id] / Number / User / System[Reference] (ID-only) as a plain scalar", () => {
    expect(enc("System[Id]", -1)).toBe("-1");
    expect(enc("Number", 42)).toBe("42");
    expect(enc("User", 5)).toBe("5"); // Write is the ID, not a nested ref
    expect(enc("System[Reference]", 100)).toBe("100"); // System[Reference] -> id only
  });

  it("converts DateTime / Date from ISO to PORTERS (UTC)", () => {
    expect(enc("DateTime", "2020-01-02T03:04:05Z")).toBe("2020/01/02 03:04:05");
    // System[DateTime] serializes identically (Write is rejected at the input type, not here)
    expect(enc("System[DateTime]", "2020-01-02T03:04:05Z")).toBe(
      "2020/01/02 03:04:05",
    );
    expect(enc("Date", "2020-01-02")).toBe("2020/01/02");
    expect(enc("Age", "1990-01-02")).toBe("1990/01/02"); // Age shares Date's wire format
  });

  it("writes Option from an array of aliases (canonical); a lone string is tolerated", () => {
    // canonical input: an array of selected aliases (ADR-0017, symmetric with read)
    expect(enc("Option", ["Option.P_Tokyo", "Option.P_Kanagawa"])).toBe(
      "<Option.P_Tokyo/><Option.P_Kanagawa/>",
    );
    // fail-safe: a lone string is wrapped as a 1-element selection
    expect(enc("Option", "Option.P_Tokyo")).toBe("<Option.P_Tokyo/>");
  });
});

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

describe("encodeField: Image / Link (ADR-0064)", () => {
  it("writes an Image as the three nested sub-elements, in PORTERS' order", () => {
    expect(
      enc("Image", {
        Content: "QUJD",
        FileName: "photo.png",
        ContentType: "image/png",
      }),
    ).toBe(
      "<FileName>photo.png</FileName>" +
        "<ContentType>image/png</ContentType>" +
        "<Content>QUJD</Content>",
    );
  });

  it("escapes an image sub-value and omits a key that is not there (cast-only)", () => {
    expect(
      enc("Image", {
        FileName: "a&b<c>.png",
      } as unknown as Parameters<typeof encodeField>[1]),
    ).toBe("<FileName>a&amp;b&lt;c&gt;.png</FileName>");
  });

  it("falls back to a scalar when an Image value is not an object (cast-only)", () => {
    expect(enc("Image", "photo.png")).toBe("photo.png");
    expect(enc("Image", ["a"])).toBe("a");
  });

  it("serializes an object handed to a non-Image type visibly (cast-only)", () => {
    expect(
      enc("SinglelineText", {
        FileName: "photo.png",
      } as unknown as Parameters<typeof encodeField>[1]),
    ).toBe('{"FileName":"photo.png"}');
  });

  it("writes a Link as the referenced id only", () => {
    expect(enc("Link", 10001)).toBe("10001");
  });

  it("nests an Image inside its own field element on a write", () => {
    const xml = buildWriteXml({
      resource: "Resume",
      prefix: "Resume",
      fields: new Map<string, DataType>([["U_photo", "Image"]]),
      items: [
        {
          U_photo: {
            FileName: "photo.png",
            ContentType: "image/png",
            Content: "QUJD",
          },
        },
      ],
    });
    expect(xml).toBe(
      "<Resume><Item><Resume.U_photo>" +
        "<FileName>photo.png</FileName>" +
        "<ContentType>image/png</ContentType>" +
        "<Content>QUJD</Content>" +
        "</Resume.U_photo></Item></Resume>",
    );
  });
});

// RV-36: 日時だけは変換するので、変換できない値は送れない。以前はここで素の RangeError が飛び、
// PortersError の系統から外れていた＝ガイドが勧める `instanceof PortersError` の分岐で漏れた。
describe("変換できない値（RV-36）", () => {
  it("ISO でない日付は PortersConfigError（category: validation）", () => {
    try {
      enc("Date", "not-a-date", "U_hiredOn");
      expect.unreachable();
    } catch (e) {
      const err = e as PortersConfigError;
      expect(err).toBeInstanceOf(PortersConfigError);
      expect(err).toBeInstanceOf(PortersError);
      expect(err.category).toBe("validation");
      expect(err.message).toContain("U_hiredOn");
      expect(err.hint).toContain("ISO 8601");
      // 原因の RangeError は cause に残す（握り潰さない）。
      expect(err.cause).toBeInstanceOf(RangeError);
    }
  });

  it("PORTERS 形式をそのまま渡した典型的な取り違えも弾く", () => {
    // ライブラリの入力は ISO 8601（PRD R-10）。素通しにすると "2026/09/09" は通るが
    // ISO の側が変換されずに出ていくので、弾く側で揃えている。
    expect(() => enc("Date", "2026/09/09")).toThrow(PortersConfigError);
  });

  it("DateTime / Age も同じ経路", () => {
    expect(() => enc("DateTime", "nope")).toThrow(PortersConfigError);
    expect(() => enc("Age", "nope")).toThrow(PortersConfigError);
  });

  it("変換を持たない型は素通し＝検査しない（意図した非対称・#4 = 案3）", () => {
    // サーバーが弾くものを手前で弾いても防げるのは silent な失敗ではないので足していない。
    expect(enc("Number", "abc")).toBe("abc");
    expect(enc("Mail", "not-a-mail")).toBe("not-a-mail");
    expect(enc("Telephone", "---")).toBe("---");
    expect(enc("URL", "nope")).toBe("nope");
  });
});

// Property-based tests (fast-check). エスケープは「& < > を並べた 1 本の文字列」で
// 確かめているが、それだと「どんな文字列でも書いて読んだら元に戻る」という肝心の
// 不変条件は代表値の外で崩れても見えない。値を機械に選ばせて往復性を直接検査する。
describe("Write XML: 書いて読むと戻る（property-based）", () => {
  // parser.ts と同じ設定。ここが食い違うと「往復した」ことにならない。
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
