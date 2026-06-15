import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PortersAuthError, PortersResourceError } from "../errors/index";
import { parseAuthentication, parseResourcePage } from "./parser";

const fixture = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../test/fixtures/${path}`, import.meta.url)),
    "utf8",
  );

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

  it("surfaces unparseable XML as PortersResourceError(unknown)", () => {
    let err: unknown;
    try {
      parseResourcePage("plain text");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).category).toBe("unknown");
  });

  it("defaults missing attributes and Code to 0", () => {
    const page = parseResourcePage(
      "<Candidate><Item><Person.P_Id>1</Person.P_Id></Item></Candidate>",
    );
    expect(page.total).toBe(0); // @_Total missing -> "0"
    expect(page.items).toHaveLength(1);
  });

  it("normalizes a non-record Item to an empty object", () => {
    const page = parseResourcePage(
      `<Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item>txt</Item></Candidate>`,
    );
    expect(page.items).toEqual([{}]);
  });
});

describe("parseAuthentication (ADR-0011)", () => {
  it("parses token fields from a Token response", () => {
    const a = parseAuthentication(
      `<Authentication><AccessToken>A</AccessToken><AccessTokenExpiresIn>1800000</AccessTokenExpiresIn><RefreshToken>R</RefreshToken><RefreshTokenExpiresIn>7200000</RefreshTokenExpiresIn><Error>0</Error></Authentication>`,
    );
    expect(a.accessToken).toBe("A");
    expect(a.refreshToken).toBe("R");
    expect(a.accessTokenExpiresIn).toBe(1800000);
  });

  it("returns the code from a code_direct response", () => {
    expect(
      parseAuthentication(
        "<Authentication><Code>C</Code><Error>0</Error></Authentication>",
      ).code,
    ).toBe("C");
  });

  it("routes <Error>!=0 to a PortersAuthError", () => {
    let err: unknown;
    try {
      parseAuthentication(
        "<Authentication><Error>401</Error></Authentication>",
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersAuthError);
    expect((err as PortersAuthError).code).toBe(401);
  });

  it("surfaces unparseable XML as PortersAuthError(unknown)", () => {
    let err: unknown;
    try {
      parseAuthentication("plain text");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersAuthError);
    expect((err as PortersAuthError).category).toBe("unknown");
  });

  it("auth error without a Message uses a default message", () => {
    let err: unknown;
    try {
      parseAuthentication(
        "<Authentication><Error>500</Error></Authentication>",
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersAuthError);
  });

  it("treats a missing <Error> as success", () => {
    const a = parseAuthentication(
      "<Authentication><Code>C</Code></Authentication>",
    );
    expect(a.code).toBe("C");
  });
});
