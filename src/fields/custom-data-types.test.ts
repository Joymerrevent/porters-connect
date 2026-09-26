import { describe, expect, it } from "vitest";

import { CUSTOM_DATA_TYPES } from "./custom-data-types";

describe("CUSTOM_DATA_TYPES（ADR-0023 D3 / ADR-0064 案5a）", () => {
  it("offers the value-shaped Data Types, Image and Link included", () => {
    expect(CUSTOM_DATA_TYPES).toContain("Image");
    expect(CUSTOM_DATA_TYPES).toContain("Link");
    expect(CUSTOM_DATA_TYPES).toContain("Option");
  });

  it("does not offer the system-managed family", () => {
    for (const t of ["System[Id]", "System[DateTime]", "System[Reference]"]) {
      expect(CUSTOM_DATA_TYPES as readonly string[]).not.toContain(t);
    }
  });
});
