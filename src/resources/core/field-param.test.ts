import { describe, expect, it } from "vitest";

import { createFieldParam } from "./field-param";
import type { FieldCatalog } from "./catalog";

describe("core/field-param — createFieldParam（省略時は全項目・裸の alias に接頭辞）", () => {
  const CATALOG = {
    P_Id: "System[Id]",
    P_Owner: "User",
    P_Name: "SinglelineText",
  } as const satisfies FieldCatalog;
  const fieldOf = (field: readonly string[] | undefined): string | null => {
    const p = new URLSearchParams();
    createFieldParam("W", CATALOG)(p, field);
    return p.get("field");
  };

  it("sends every catalogued alias when field is omitted (User expanded to its 4 sub-fields)", () => {
    expect(fieldOf(undefined)).toBe(
      "W.P_Id,W.P_Owner(User.P_Id,User.P_Type,User.P_Name,User.P_Mail),W.P_Name",
    );
  });

  it("prefixes the caller's own aliases and adds nothing else", () => {
    expect(fieldOf(["P_Name"])).toBe("W.P_Name");
  });

  it("sends no field at all for []", () => {
    expect(fieldOf([])).toBeNull();
  });
});
