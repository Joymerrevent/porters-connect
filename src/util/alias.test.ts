import { describe, expect, it } from "vitest";

import { bareAlias, qualify } from "./alias";

describe("qualify", () => {
  it("joins a prefix and a bare alias the way PORTERS names fields", () => {
    expect(qualify("Person", "P_Name")).toBe("Person.P_Name");
    expect(qualify("Client", "P_Id")).toBe("Client.P_Id");
  });

  it("returns the bare alias when the resource has no prefix (Phase — ADR-0061)", () => {
    // The whole point: an empty prefix must not produce a leading dot.
    expect(qualify("", "Id")).toBe("Id");
    expect(qualify("", "ResourceId")).toBe("ResourceId");
  });
});

describe("bareAlias", () => {
  it("drops the prefix PORTERS puts on a tag or an entry", () => {
    expect(bareAlias("Person.P_Name")).toBe("P_Name");
    expect(bareAlias("Client.U_score")).toBe("U_score");
  });

  it("leaves a bare alias as it is (Phase has no prefix)", () => {
    expect(bareAlias("P_Name")).toBe("P_Name");
    expect(bareAlias("ResourceId")).toBe("ResourceId");
  });

  it("undoes qualify", () => {
    expect(bareAlias(qualify("Person", "P_Name"))).toBe("P_Name");
    expect(bareAlias(qualify("", "Id"))).toBe("Id");
  });
});
