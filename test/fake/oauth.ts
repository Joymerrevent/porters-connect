// PORTERS' own OAuth, faithfully enough to exercise the library's token lifecycle
// (ADR-0007 / ADR-0012 / ADR-0036): `code_direct` mints a code that expires in 30 seconds, the
// Token endpoint exchanges a code or a Refresh Token, and expiries travel in **milliseconds**
// (token.md: Access ~1,800,000 / Refresh ~7,200,000).
//
// Error numbering is the Authentication family (`<Authentication><Error>`), which is a different
// system from the Resource Result Codes — mixing the two is exactly the sort of drift this fake
// is meant to catch.

import { PortersConfigError } from "../../src/errors/index";
import type { TransportResponse } from "../../src/http/types";
import { buildAuthenticationXml } from "./wire";

/** `code` lives 30 seconds (oauth.md) — long enough to exchange, short enough to matter. */
const CODE_TTL_MS = 30_000;
const ACCESS_TOKEN_TTL_MS = 1_800_000;
const REFRESH_TOKEN_TTL_MS = 7_200_000;

/** How a presented Access Token looks to the Resource API. */
export type TokenState = "valid" | "expired" | "invalid";

export type FakeAuth = {
  /** `GET /v1/oauth` (only `code_direct` can run offline). */
  handleOAuth(url: URL): TransportResponse;
  /** `POST /v1/token`. */
  handleToken(body: string | undefined): TransportResponse;
  checkAccessToken(token: string | undefined): TokenState;
  /** Mint a `code` as the browser grant would, for `auth.exchangeAuthorizationCode` tests. */
  issueAuthorizationCode(): string;
  expireAccessTokens(): void;
  reset(): void;
};

type Issued = { expiresAt: number };

const authErrorXml = (error: number, message: string): TransportResponse => ({
  // Authentication errors ride an HTTP 200 envelope; the library routes on `<Error>`.
  status: 200,
  body: buildAuthenticationXml({ Error: String(error), Message: message }),
});

export const createFakeAuth = (opts: { now: () => number }): FakeAuth => {
  const codes = new Map<string, Issued>();
  const accessTokens = new Map<string, Issued>();
  const refreshTokens = new Map<string, Issued>();
  let counter = 0;

  const mint = (prefix: string): string => {
    counter += 1;
    return `${prefix}-${counter}`;
  };

  const issueCode = (): string => {
    const code = mint("fake-code");
    codes.set(code, { expiresAt: opts.now() + CODE_TTL_MS });
    return code;
  };

  const live = (entry: Issued | undefined): boolean =>
    entry !== undefined && opts.now() < entry.expiresAt;

  const issueTokens = (): TransportResponse => {
    const accessToken = mint("fake-access");
    const refreshToken = mint("fake-refresh");
    accessTokens.set(accessToken, {
      expiresAt: opts.now() + ACCESS_TOKEN_TTL_MS,
    });
    refreshTokens.set(refreshToken, {
      expiresAt: opts.now() + REFRESH_TOKEN_TTL_MS,
    });
    return {
      status: 200,
      body: buildAuthenticationXml({
        AccessToken: accessToken,
        AccessTokenExpiresIn: String(ACCESS_TOKEN_TTL_MS),
        RefreshToken: refreshToken,
        RefreshTokenExpiresIn: String(REFRESH_TOKEN_TTL_MS),
        Error: "0",
        Message: "Success",
      }),
    };
  };

  const handleOAuth = (url: URL): TransportResponse => {
    const appId = url.searchParams.get("app_id");
    const responseType = url.searchParams.get("response_type");
    if (appId === null || appId === "")
      return authErrorXml(104, "Invalid app_id");
    if (responseType !== "code_direct") {
      // `code` / `remove` are browser round-trips (a login + consent screen), so they cannot be
      // answered offline. Fail loud instead of inventing a grant (fail-safe); tests drive the
      // browser grant with `control.issueAuthorizationCode()`.
      throw new PortersConfigError(
        `fake server: response_type "${responseType ?? ""}" needs a browser; only code_direct is answered offline`,
        {
          category: "config",
          hint: "Use control.issueAuthorizationCode() to simulate the browser `code` grant, then call auth.exchangeAuthorizationCode(code).",
        },
      );
    }
    return {
      status: 200,
      body: buildAuthenticationXml({
        Code: issueCode(),
        Error: "0",
        Message: "Success",
      }),
    };
  };

  const handleToken = (body: string | undefined): TransportResponse => {
    const form = new URLSearchParams(body ?? "");
    const appId = form.get("app_id");
    const secret = form.get("secret");
    const grantType = form.get("grant_type");
    const code = form.get("code") ?? "";
    if (appId === null || appId === "")
      return authErrorXml(104, "Invalid app_id");
    if (secret === null || secret === "")
      return authErrorXml(105, "Invalid secret");
    if (grantType === "oauth_code") {
      const issued = codes.get(code);
      if (!live(issued)) return authErrorXml(103, "Invalid code");
      // A code is single-use: exchanging it twice must not work.
      codes.delete(code);
      return issueTokens();
    }
    if (grantType === "refresh_token") {
      const issued = refreshTokens.get(code);
      if (issued === undefined)
        return authErrorXml(107, "Invalid Refresh Token");
      // 401 (Refresh Token expired) is the signal to re-acquire from scratch — ADR-0036.
      if (!live(issued)) return authErrorXml(401, "Refresh Token has expired");
      return issueTokens();
    }
    return authErrorXml(112, "Invalid grant_type");
  };

  return {
    handleOAuth,
    handleToken,
    checkAccessToken: (token) => {
      if (token === undefined || token === "") return "invalid";
      const issued = accessTokens.get(token);
      if (issued === undefined) return "invalid";
      return live(issued) ? "valid" : "expired";
    },
    issueAuthorizationCode: issueCode,
    expireAccessTokens: () => {
      for (const [token] of accessTokens) {
        accessTokens.set(token, { expiresAt: opts.now() });
      }
    },
    reset: () => {
      codes.clear();
      accessTokens.clear();
      refreshTokens.clear();
      counter = 0;
    },
  };
};
