import { describe, expect, it } from "vitest";

import type { FieldValue } from "../xml/decode";
import { decoderFor, type FieldCatalog } from "./read-core";

// runRead / paginate are exercised through resource.test.ts and the master tests; here we pin
// the shared decoder directly, including bareAlias on both prefixed and prefix-less keys.
const FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
} as const satisfies FieldCatalog;

describe("read-core — decoderFor", () => {
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
});
