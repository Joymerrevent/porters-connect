import { describe, expect, it } from "vitest";

import {
  DELETED_CONDITION_FIELDS,
  KEYWORDS_MAX_CHARS,
  MAX_READ_COUNT,
  MIN_READ_COUNT,
  USER_SUBFIELDS,
} from "./read-rules";

// 値は出典（docs/usage/reference）のとおりに固定する。出典が変わったらここが落ちる。
describe("porters/read-rules", () => {
  it("takes a count of 1 to 200", () => {
    expect([MIN_READ_COUNT, MAX_READ_COUNT]).toEqual([1, 200]);
  });

  it("caps keywords at 100 characters", () => {
    expect(KEYWORDS_MAX_CHARS).toBe(100);
  });

  it("returns 4 sub-fields for a User-type field", () => {
    expect(USER_SUBFIELDS).toEqual(["P_Id", "P_Type", "P_Name", "P_Mail"]);
  });

  it("lets a deleted read condition on 3 fields only", () => {
    expect([...DELETED_CONDITION_FIELDS]).toEqual([
      "P_Id",
      "P_UpdateDate",
      "P_UpdatedBy",
    ]);
  });
});
