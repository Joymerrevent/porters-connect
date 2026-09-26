import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import {
  assertCustomAlias,
  assertCustomDataType,
  assertDeclaredCatalogs,
  assertKnownResource,
} from "./assert-declared-catalogs";
import { CUSTOM_DATA_TYPES } from "./custom-data-types";

const errorOf = (f: () => void): PortersConfigError => {
  try {
    f();
  } catch (e) {
    return e as PortersConfigError;
  }
  throw new Error("expected a throw");
};

describe("assertKnownResource / assertCustomAlias", () => {
  it("names where the check ran", () => {
    expect(errorOf(() => assertKnownResource("tenant", "widget")).message).toBe(
      'tenant: unknown resource "widget" (expected one of candidate, job, client, recruiter, contact, opportunity, activity, contract, sales, process, resume)',
    );
    expect(
      errorOf(() => assertCustomAlias("tenant", "P_x", "job")).message,
    ).toBe(
      'tenant: custom field alias "P_x" on "job" must start with "U_" or "A_" (standard P_ fields are built in)',
    );
  });

  it("passes a known resource and a U_ / A_ alias", () => {
    expect(() => assertKnownResource("tenant", "resume")).not.toThrow();
    expect(() => assertCustomAlias("tenant", "A_x", "job")).not.toThrow();
  });
});

// RV-79。知らない Data Type の宣言は、読むと項目が消え、書くと "undefined" が送られていた。
describe("assertCustomDataType", () => {
  it.each(CUSTOM_DATA_TYPES)("passes %s", (dataType) => {
    expect(() =>
      assertCustomDataType("tenant", dataType, "U_x", "job"),
    ).not.toThrow();
  });

  it.each([["Bogus"], ["number"], ["System[Id]"], [undefined], [3]])(
    "refuses %j",
    (dataType) => {
      const e = errorOf(() =>
        assertCustomDataType("defineFields", dataType, "U_x", "job"),
      );
      expect(e).toBeInstanceOf(PortersConfigError);
      expect(e.message).toBe(
        `defineFields: "U_x" on "job" has Data Type ${JSON.stringify(dataType) ?? String(dataType)}, which a custom field cannot have`,
      );
      expect(e.category).toBe("config");
      expect(e.hint).toContain("f.number()");
      expect(e.hint).toContain(CUSTOM_DATA_TYPES.join(", "));
    },
  );
});

describe("assertDeclaredCatalogs", () => {
  it("passes a declaration of known resources, U_ / A_ aliases and custom Data Types", () => {
    expect(() =>
      assertDeclaredCatalogs("tenant", {
        job: { U_x: "Number", A_y: "Option" },
      }),
    ).not.toThrow();
  });

  it.each([
    [null, "fields must be the result of defineFields, got null"],
    ["x", 'fields must be the result of defineFields, got "x"'],
    [
      { job: "Number" },
      'the declaration for "job" must map aliases to Data Types',
    ],
    [{ job: null }, 'the declaration for "job" must map aliases to Data Types'],
    [{ widget: {} }, 'unknown resource "widget"'],
    [{ job: { P_x: "Number" } }, 'custom field alias "P_x" on "job"'],
    [{ job: { U_x: "Bogus" } }, '"U_x" on "job" has Data Type "Bogus"'],
  ])("refuses %j", (fields, message) => {
    const e = errorOf(() => assertDeclaredCatalogs("tenant", fields));
    expect(e).toBeInstanceOf(PortersConfigError);
    expect(e.message).toContain(`tenant: ${message}`);
    expect(e.category).toBe("config");
  });

  it("hints at defineFields when the declaration is not an object", () => {
    expect(errorOf(() => assertDeclaredCatalogs("tenant", null)).hint).toBe(
      "Pass fields: defineFields({ … }).",
    );
    expect(
      errorOf(() => assertDeclaredCatalogs("tenant", { job: 1 })).hint,
    ).toBe("Pass fields: defineFields({ … }).");
  });

  it("shows undefined as it was passed", () => {
    expect(
      errorOf(() => assertDeclaredCatalogs("tenant", undefined)).message,
    ).toBe("tenant: fields must be the result of defineFields, got undefined");
  });
});
