import { describe, expect, it } from "vitest";

import { idAliasOf } from "./descriptor";

describe("accessor/descriptor — idAliasOf", () => {
  it("is P_Id unless the resource names its own (Phase uses Id)", () => {
    expect(idAliasOf({})).toBe("P_Id");
    expect(idAliasOf({ idAlias: "Id" })).toBe("Id");
  });
});
