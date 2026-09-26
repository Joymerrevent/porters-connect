import { describe, expect, it } from "vitest";

import { fieldTypesOf } from "./catalog";

describe("accessor/catalog — fieldTypesOf", () => {
  it("looks each alias up by name, keeping a catalogued null apart from an unknown alias", () => {
    const types = fieldTypesOf({ P_Id: "System[Id]", P_Deleted: null });
    expect(types.get("P_Id")).toBe("System[Id]");
    expect(types.get("P_Deleted")).toBeNull();
    expect(types.has("P_Deleted")).toBe(true);
    expect(types.get("U_unknown")).toBeUndefined();
    expect([...types.keys()]).toEqual(["P_Id", "P_Deleted"]);
  });
});
