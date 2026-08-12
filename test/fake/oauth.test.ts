// PORTERS' OAuth is unusual enough (30-second code, millisecond expiries, two error families) that
// the fake reproducing it faithfully is most of its value — so these tests pin the parts the
// library's token lifecycle depends on.

import { describe, expect, it } from "vitest";

import { parseAuthentication } from "../../src/xml/parser";
import { createFakeAuth } from "./oauth";

const oauthUrl = (query = "app_id=app&response_type=code_direct"): URL =>
  new URL(`https://fake.test/v1/oauth?${query}`);

const tokenBody = (
  grantType: string,
  code: string,
  extra: Record<string, string> = {},
): string =>
  new URLSearchParams({
    app_id: "app",
    secret: "secret",
    grant_type: grantType,
    code,
    ...extra,
  }).toString();

const setup = () => {
  let clock = 1_700_000_000_000;
  const auth = createFakeAuth({ now: () => clock });
  return {
    auth,
    advance: (ms: number) => {
      clock += ms;
    },
  };
};

const grantCode = (auth: ReturnType<typeof setup>["auth"]): string =>
  parseAuthentication(auth.handleOAuth(oauthUrl()).body).code ?? "";

describe("code_direct grant", () => {
  it("answers a code in the documented envelope", () => {
    const { auth } = setup();

    const parsed = parseAuthentication(auth.handleOAuth(oauthUrl()).body);

    expect(parsed.code).toMatch(/^fake-code-/);
  });

  it("rejects a missing app_id with authentication error 104", () => {
    const { auth } = setup();

    const answer = auth.handleOAuth(oauthUrl("response_type=code_direct"));

    expect(() => parseAuthentication(answer.body)).toThrow(
      expect.objectContaining({ name: "PortersAuthError", code: 104 }),
    );
  });

  it("refuses the browser grants instead of inventing one", () => {
    const { auth } = setup();

    expect(() =>
      auth.handleOAuth(oauthUrl("app_id=app&response_type=code")),
    ).toThrow(/needs a browser; only code_direct is answered offline/);
  });
});

describe("token exchange", () => {
  it("issues tokens with millisecond expiries", () => {
    const { auth } = setup();

    const parsed = parseAuthentication(
      auth.handleToken(tokenBody("oauth_code", grantCode(auth))).body,
    );

    expect(parsed.accessToken).toMatch(/^fake-access-/);
    expect(parsed.accessTokenExpiresIn).toBe(1_800_000);
    expect(parsed.refreshTokenExpiresIn).toBe(7_200_000);
  });

  it("expires a code after 30 seconds", () => {
    const { auth, advance } = setup();
    const code = grantCode(auth);

    advance(29_000);
    expect(() =>
      parseAuthentication(auth.handleToken(tokenBody("oauth_code", code)).body),
    ).not.toThrow();

    const stale = grantCode(auth);
    advance(30_001);
    expect(() =>
      parseAuthentication(
        auth.handleToken(tokenBody("oauth_code", stale)).body,
      ),
    ).toThrow(expect.objectContaining({ code: 103 }));
  });

  it("burns a code on use", () => {
    const { auth } = setup();
    const code = grantCode(auth);

    auth.handleToken(tokenBody("oauth_code", code));

    expect(() =>
      parseAuthentication(auth.handleToken(tokenBody("oauth_code", code)).body),
    ).toThrow(expect.objectContaining({ code: 103 }));
  });

  it("renews from a Refresh Token and reports an expired one as 401", () => {
    const { auth, advance } = setup();
    const issued = parseAuthentication(
      auth.handleToken(tokenBody("oauth_code", grantCode(auth))).body,
    );
    const refreshToken = issued.refreshToken ?? "";

    const renewed = parseAuthentication(
      auth.handleToken(tokenBody("refresh_token", refreshToken)).body,
    );
    expect(renewed.accessToken).not.toBe(issued.accessToken);

    advance(7_200_001);
    expect(() =>
      parseAuthentication(
        auth.handleToken(tokenBody("refresh_token", refreshToken)).body,
      ),
    ).toThrow(expect.objectContaining({ code: 401 }));
  });

  it("maps credential and grant mistakes to their own error codes", () => {
    const { auth } = setup();
    const expectCode = (body: string, code: number): void => {
      expect(() => parseAuthentication(auth.handleToken(body).body)).toThrow(
        expect.objectContaining({ code }),
      );
    };

    expectCode(tokenBody("oauth_code", "x", { app_id: "" }), 104);
    expectCode(tokenBody("oauth_code", "x", { secret: "" }), 105);
    expectCode(tokenBody("password", "x"), 112);
    expectCode(tokenBody("refresh_token", "never-issued"), 107);
    expectCode(tokenBody("oauth_code", "never-issued"), 103);
  });
});

describe("access token state", () => {
  it("tells valid, expired and unknown apart", () => {
    const { auth, advance } = setup();
    const issued = parseAuthentication(
      auth.handleToken(tokenBody("oauth_code", grantCode(auth))).body,
    );
    const token = issued.accessToken ?? "";

    expect(auth.checkAccessToken(token)).toBe("valid");
    expect(auth.checkAccessToken("someone-elses")).toBe("invalid");
    expect(auth.checkAccessToken(undefined)).toBe("invalid");

    advance(1_800_001);
    expect(auth.checkAccessToken(token)).toBe("expired");
  });

  it("expireAccessTokens() invalidates without touching the clock", () => {
    const { auth } = setup();
    const token =
      parseAuthentication(
        auth.handleToken(tokenBody("oauth_code", grantCode(auth))).body,
      ).accessToken ?? "";

    auth.expireAccessTokens();

    expect(auth.checkAccessToken(token)).toBe("expired");
  });

  it("reset() forgets every issued credential", () => {
    const { auth } = setup();
    const token =
      parseAuthentication(
        auth.handleToken(tokenBody("oauth_code", grantCode(auth))).body,
      ).accessToken ?? "";

    auth.reset();

    expect(auth.checkAccessToken(token)).toBe("invalid");
  });
});
