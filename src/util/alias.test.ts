import { describe, expect, it } from "vitest";

import { qualify } from "./alias";

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
