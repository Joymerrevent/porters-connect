import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { decodeField, type UserRef } from "./decode";
import { parseResourcePage } from "./parser";

function fixture(path: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../test/fixtures/${path}`, import.meta.url)),
    "utf8",
  );
}

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
});
