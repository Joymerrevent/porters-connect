import { describe, expect, it } from "vitest";

import type { DataType } from "../xml/decode";
import {
  dataTypeOfFieldType,
  fieldTypeLabel,
  fieldTypeValueOf,
  FIELD_TYPES,
} from "./field-type";

// Every Data Type the library models (`src/xml/decode.ts`). Restated here on purpose: the point of
// these tests is to catch the table falling behind the union, so reading the union would defeat it.
const ALL_DATA_TYPES: readonly DataType[] = [
  "System[Id]",
  "Number",
  "DateTime",
  "System[DateTime]",
  "Date",
  "Age",
  "SinglelineText",
  "MultilineText",
  "Mail",
  "Telephone",
  "URL",
  "User",
  "Option",
  "System[Reference]",
  "System[Department]",
  "Image",
  "Link",
];

describe("FIELD_TYPES", () => {
  it("matches the reference's Field Type list (field-data-types.md)", () => {
    expect(FIELD_TYPES.map((r) => [r.value, r.dataType, r.label])).toEqual([
      [1, "SinglelineText", "SinglelineText"],
      [2, "MultilineText", "MultilineText"],
      [3, "Number", "Number"],
      [4, "Date", "Date"],
      [5, "Option", "Option[Checkbox]"],
      [6, "Option", "Option[Radiobutton]"],
      [7, "Option", "Option[Dropdown]"],
      [8, "Age", "Age"],
      [9, "URL", "URL"],
      [10, "Mail", "Mail"],
      [11, "System[Id]", "System"],
      [11, "System[DateTime]", "System"],
      [11, "System[Reference]", "System"],
      [11, "System[Department]", "System"],
      [12, "DateTime", "DateTime"],
      [14, "Number", "Currency"],
      [15, "Telephone", "Telephone"],
      [16, null, "Reference"],
      [17, "User", "User"],
      [18, "Image", "Image"],
      [20, "Link", "Link"],
    ]);
  });

  // This is the drift guard the two-table arrangement lacked (RV-37). A Data Type added to the
  // union without a row here reverses to `undefined`, which would put "undefined" on the wire in
  // the fake — so the table failing to keep up has to fail loudly right here.
  it("gives every Data Type exactly one reverse row", () => {
    const missing = ALL_DATA_TYPES.filter(
      (t) => fieldTypeValueOf(t) === undefined,
    );
    expect(missing).toEqual([]);

    const reversed = FIELD_TYPES.filter((r) => r.reverse === true).map(
      (r) => r.dataType,
    );
    expect(reversed).toHaveLength(ALL_DATA_TYPES.length);
    expect(new Set(reversed).size).toBe(ALL_DATA_TYPES.length);
  });

  it("marks a forward winner for the one Value that repeats (11)", () => {
    const counts = new Map<number, number>();
    for (const row of FIELD_TYPES) {
      counts.set(row.value, (counts.get(row.value) ?? 0) + 1);
    }
    const repeated = [...counts].filter(([, n]) => n > 1).map(([v]) => v);
    // The Option subtypes have *distinct* values (5 / 6 / 7) — they fold on the Data Type side,
    // not here. Only the System family shares a Value.
    expect(repeated).toEqual([11]);

    const winners = FIELD_TYPES.filter(
      (r) => r.value === 11 && r.forward === true,
    );
    expect(winners).toHaveLength(1);
    expect(winners[0].dataType).toBe("System[Id]");
  });
});

describe("dataTypeOfFieldType (Value -> Data Type)", () => {
  it("maps the straightforward values", () => {
    expect(dataTypeOfFieldType(1)).toBe("SinglelineText");
    expect(dataTypeOfFieldType(3)).toBe("Number");
    expect(dataTypeOfFieldType(12)).toBe("DateTime");
    expect(dataTypeOfFieldType(17)).toBe("User");
    expect(dataTypeOfFieldType(18)).toBe("Image");
    expect(dataTypeOfFieldType(20)).toBe("Link");
  });

  it("folds the three Option subtypes onto one Data Type", () => {
    expect(dataTypeOfFieldType(5)).toBe("Option");
    expect(dataTypeOfFieldType(6)).toBe("Option");
    expect(dataTypeOfFieldType(7)).toBe("Option");
  });

  it("reads Currency (14) as a Number", () => {
    expect(dataTypeOfFieldType(14)).toBe("Number");
  });

  it("resolves the shared System value (11) to the published pair", () => {
    expect(dataTypeOfFieldType(11)).toBe("System[Id]");
  });

  // The three outcomes have to stay distinguishable (ADR-0069 論点4): a published type with no
  // Data Type is not the same thing as a Value nobody has heard of.
  it("returns null for a published type that carries no value (16 Reference)", () => {
    expect(dataTypeOfFieldType(16)).toBeNull();
  });

  it("returns undefined for a Value not in the list, rather than guessing", () => {
    // 13 and 19 are absent from the reference; 21+ is whatever PORTERS adds next.
    expect(dataTypeOfFieldType(13)).toBeUndefined();
    expect(dataTypeOfFieldType(19)).toBeUndefined();
    expect(dataTypeOfFieldType(99)).toBeUndefined();
  });
});

describe("fieldTypeValueOf (Data Type -> Value)", () => {
  it("picks the representative where several values share a Data Type", () => {
    expect(fieldTypeValueOf("Option")).toBe(7); // not 5 or 6
    expect(fieldTypeValueOf("Number")).toBe(3); // not Currency's 14
    expect(fieldTypeValueOf("System[Id]")).toBe(11);
    expect(fieldTypeValueOf("System[DateTime]")).toBe(11);
    expect(fieldTypeValueOf("System[Reference]")).toBe(11);
    expect(fieldTypeValueOf("System[Department]")).toBe(11);
  });

  it("round-trips every Data Type back to itself", () => {
    for (const dataType of ALL_DATA_TYPES) {
      const value = fieldTypeValueOf(dataType);
      expect(value).toBeDefined();
      // Option / Currency / the System family fold, so the round trip lands on the
      // representative rather than the same row — that is the documented behaviour.
      const back = dataTypeOfFieldType(value as number);
      const folds =
        dataType === "System[DateTime]" ||
        dataType === "System[Reference]" ||
        dataType === "System[Department]";
      expect(back).toBe(folds ? "System[Id]" : dataType);
    }
  });
});

describe("fieldTypeLabel", () => {
  it("names the Field Type as PORTERS does", () => {
    expect(fieldTypeLabel(7)).toBe("Option[Dropdown]");
    expect(fieldTypeLabel(14)).toBe("Currency");
    expect(fieldTypeLabel(16)).toBe("Reference");
    expect(fieldTypeLabel(11)).toBe("System");
  });

  it("has no label for an unknown Value", () => {
    expect(fieldTypeLabel(13)).toBeUndefined();
  });
});
