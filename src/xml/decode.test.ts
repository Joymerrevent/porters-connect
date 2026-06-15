import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { decodeField, type UserRef } from "./decode";
import { parseResourcePage } from "./parser";

const fixture = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../test/fixtures/${path}`, import.meta.url)),
    "utf8",
  );

describe("decodeField (ADR-0011)", () => {
  const page = parseResourcePage(fixture("candidate/read-basic.xml"));
  const first = page.items[0];
  const second = page.items[1];

  it("decodes Id to a number", () => {
    expect(decodeField("Id", first["Person.P_Id"])).toBe(10001);
  });

  it("keeps Text as string (no numeric coercion) and empty -> null", () => {
    expect(decodeField("Text", first["Person.P_Name"])).toBe("山田 太郎");
    expect(decodeField("Text", second["Person.P_Mail"])).toBeNull();
  });

  it("decodes DateTime to ISO (...Z)", () => {
    expect(decodeField("DateTime", first["Person.P_UpdateDate"])).toBe(
      "2026-01-02T03:04:05Z",
    );
  });

  it("decodes User to a nested object", () => {
    const owner = decodeField("User", first["Person.P_Owner"]) as UserRef;
    expect(owner.P_Id).toBe(5);
    expect(owner.P_Type).toBe("0"); // prefixed User.P_Type resolves, not && null
    expect(owner.P_Name).toBe("採用 花子");
    expect(owner.P_Mail).toBe("hanako@example.com");
  });

  it("decodes a single Option to its end alias", () => {
    expect(decodeField("Option", first["Person.P_Phase"])).toBe(
      "P_PersonPhase_Applied",
    );
  });

  it("a field not present in the item -> null", () => {
    expect(decodeField("Text", second["Person.P_Country"])).toBeNull();
  });

  it("decodes Number and Date; empty -> null", () => {
    expect(decodeField("Number", "3.14")).toBe(3.14);
    expect(decodeField("Number", "")).toBeNull();
    expect(decodeField("Date", "2026/01/02")).toBe("2026-01-02");
  });

  it("Option without an OptionRoot -> null", () => {
    expect(decodeField("Option", { x: 1 })).toBeNull();
    expect(decodeField("Option", "scalar")).toBeNull();
  });

  it("User: prefix-less keys resolve; missing User -> null", () => {
    const u = decodeField("User", {
      User: { P_Id: "9", P_Name: "n" },
    }) as UserRef;
    expect(u.P_Id).toBe(9);
    expect(u.P_Name).toBe("n");
    expect(decodeField("User", { nope: 1 })).toBeNull();
  });

  it("decodes defensively: non-string -> null; missing nested -> null", () => {
    expect(decodeField("Id", { a: 1 })).toBeNull();
    expect(decodeField("Number", { a: 1 })).toBeNull();
    expect(decodeField("DateTime", { a: 1 })).toBeNull();
    expect(decodeField("Date", { a: 1 })).toBeNull();
    expect(decodeField("Text", { a: 1 })).toBeNull();
    const owner = decodeField("User", { User: { P_Name: "n" } }) as UserRef;
    expect(owner.P_Id).toBeNull();
    expect(decodeField("Option", { OptionRoot: {} })).toBeNull();
  });
});
