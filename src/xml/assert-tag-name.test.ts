import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors/index";
import { assertTagName } from "./assert-tag-name";

describe("assertTagName（ADR-0085）", () => {
  it("passes a valid XML Name", () => {
    expect(() =>
      assertTagName("P_Name", "field alias", "P_Name"),
    ).not.toThrow();
    expect(() =>
      assertTagName("Option.P_Applied", "option alias", "P_Phase"),
    ).not.toThrow();
  });

  it("refuses anything else as a validation error that names the value, its kind and the field", () => {
    let err: unknown;
    try {
      assertTagName("a b", "option alias", "P_Phase");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    const e = err as PortersConfigError;
    expect(e.category).toBe("validation");
    expect(e.message).toContain('P_Phase: option alias "a b"');
    expect(e.hint).toContain("XML Name");
    expect(e.context).toEqual({ operation: "encode" });
  });
});
