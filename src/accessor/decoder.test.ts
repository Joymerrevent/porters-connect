import { describe, expect, it } from "vitest";

import type { FieldValue } from "../xml/decode";
import { decoderFor } from "./decoder";
import type { FieldCatalog } from "./catalog";

// Pins the shared decoder directly, including bareAlias on both prefixed and prefix-less keys.
const FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
  // カタログにあるが PORTERS が Data Type を与えていない項目（ADR-0056）。
  P_Deleted: null,
} as const satisfies FieldCatalog;

describe("accessor/decoder — decoderFor", () => {
  it("decodes catalogued fields by both prefixed and prefix-less alias", () => {
    const rec = decoderFor(FIELDS)({ "X.P_Id": "7", P_Name: "hi" }) as Record<
      string,
      FieldValue | undefined
    >;
    expect(rec.P_Id).toBe(7); // "X.P_Id" -> bareAlias -> catalog (System[Id] -> number)
    expect(rec.P_Name).toBe("hi"); // a dotless key hits the catalog directly
  });

  it("passes an unknown alias through as a string and nulls a nested unknown", () => {
    const rec = decoderFor(FIELDS)({ U_x: "raw", U_obj: { n: "1" } }) as Record<
      string,
      FieldValue | undefined
    >;
    expect(rec.U_x).toBe("raw");
    expect(rec.U_obj).toBeNull();
  });

  it("catalogued but Data-Type-less (null) fields keep the raw string (ADR-0056)", () => {
    const rec = decoderFor(FIELDS)({ "X.P_Deleted": "1" }) as Record<
      string,
      FieldValue | undefined
    >;
    expect(rec.P_Deleted).toBe("1");
  });
});
