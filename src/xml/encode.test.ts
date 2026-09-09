import { describe, expect, it } from "vitest";

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
      expect(encodeField(t, "a&b<c>d")).toBe("a&amp;b&lt;c&gt;d");
    }
    expect(encodeField("MultilineText", "山田 太郎")).toBe("山田 太郎");
  });

  it("serializes System[Id] / Number / User / System[Reference] (ID-only) as a plain scalar", () => {
    expect(encodeField("System[Id]", -1)).toBe("-1");
    expect(encodeField("Number", 42)).toBe("42");
    expect(encodeField("User", 5)).toBe("5"); // Write is the ID, not a nested ref
    expect(encodeField("System[Reference]", 100)).toBe("100"); // System[Reference] -> id only
  });

  it("converts DateTime / Date from ISO to PORTERS (UTC)", () => {
    expect(encodeField("DateTime", "2020-01-02T03:04:05Z")).toBe(
      "2020/01/02 03:04:05",
    );
    // System[DateTime] serializes identically (Write is rejected at the input type, not here)
    expect(encodeField("System[DateTime]", "2020-01-02T03:04:05Z")).toBe(
      "2020/01/02 03:04:05",
    );
    expect(encodeField("Date", "2020-01-02")).toBe("2020/01/02");
    expect(encodeField("Age", "1990-01-02")).toBe("1990/01/02"); // Age shares Date's wire format
  });

  it("writes Option from an array of aliases (canonical); a lone string is tolerated", () => {
    // canonical input: an array of selected aliases (ADR-0017, symmetric with read)
    expect(encodeField("Option", ["Option.P_Tokyo", "Option.P_Kanagawa"])).toBe(
      "<Option.P_Tokyo/><Option.P_Kanagawa/>",
    );
    // fail-safe: a lone string is wrapped as a 1-element selection
    expect(encodeField("Option", "Option.P_Tokyo")).toBe("<Option.P_Tokyo/>");
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
      encodeField("Image", {
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
      encodeField("Image", {
        FileName: "a&b<c>.png",
      } as unknown as Parameters<typeof encodeField>[1]),
    ).toBe("<FileName>a&amp;b&lt;c&gt;.png</FileName>");
  });

  it("falls back to a scalar when an Image value is not an object (cast-only)", () => {
    expect(encodeField("Image", "photo.png")).toBe("photo.png");
    expect(encodeField("Image", ["a"])).toBe("a");
  });

  it("serializes an object handed to a non-Image type visibly (cast-only)", () => {
    expect(
      encodeField("SinglelineText", {
        FileName: "photo.png",
      } as unknown as Parameters<typeof encodeField>[1]),
    ).toBe('{"FileName":"photo.png"}');
  });

  it("writes a Link as the referenced id only", () => {
    expect(encodeField("Link", 10001)).toBe("10001");
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
