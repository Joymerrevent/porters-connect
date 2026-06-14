import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PortersResourceError } from "../errors/index";
import { parseResourcePage } from "./parser";

function fixture(path: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../test/fixtures/${path}`, import.meta.url)),
    "utf8",
  );
}

describe("parseResourcePage (ADR-0011)", () => {
  it("reads Total/Count/Start and Items as raw strings", () => {
    const page = parseResourcePage(fixture("candidate/read-basic.xml"));
    expect(page.total).toBe(2);
    expect(page.count).toBe(2);
    expect(page.start).toBe(0);
    expect(page.items).toHaveLength(2);
    // raw string: no coercion at the parser layer
    expect(page.items[0]["Person.P_Id"]).toBe("10001");
  });

  it("normalizes a 0-item response to an empty array", () => {
    const page = parseResourcePage(fixture("candidate/read-empty.xml"));
    expect(page.total).toBe(0);
    expect(page.items).toEqual([]);
  });

  it("routes <Code>!=0 to a mapped PortersError (200+Code is an error)", () => {
    let err: unknown;
    try {
      parseResourcePage(fixture("errors/resource-403.xml"));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).code).toBe(403);
    expect((err as PortersResourceError).category).toBe("permission");
  });
});
