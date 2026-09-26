import { describe, expect, it } from "vitest";

import { PortersAuthError } from "../errors/index";
import { parseAuthentication } from "./parse-authentication";

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
    const a = parseAuthentication(
      "<Authentication><Code>C</Code><Error>0</Error></Authentication>",
    );
    expect(a.code).toBe("C");
    // a missing ExpiresIn stays undefined, not NaN
    expect(a.accessTokenExpiresIn).toBeUndefined();
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

  it("prefers the response <Message> over the default", () => {
    let err: unknown;
    try {
      parseAuthentication(
        "<Authentication><Error>401</Error><Message>bad creds</Message></Authentication>",
      );
    } catch (e) {
      err = e;
    }
    expect((err as PortersAuthError).message).toBe("bad creds");
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
    expect((err as PortersAuthError).message).toBe(
      "unparseable authentication response",
    );
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
    expect((err as PortersAuthError).message).toBe("authentication error 500");
  });

  it("treats a missing <Error> as success", () => {
    const a = parseAuthentication(
      "<Authentication><Code>C</Code></Authentication>",
    );
    expect(a.code).toBe("C");
  });
});
