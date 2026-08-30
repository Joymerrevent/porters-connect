import { describe, expect, it } from "vitest";

import { PortersAuthError, PortersError } from "../errors/index";
import type {
  Transport,
  TransportRequest,
  TransportResponse,
} from "../http/index";
import { exchangeToken, type TokenExchangeDeps } from "./token-exchange";

// `exchangeToken` is reached through two callers (the transparent provider's code_direct grant and
// the public auth API's browser `code` exchange), so their tests exercise it only along the paths
// they need. These pin the exchange's own contract: what goes on the wire, how relative expiry
// becomes absolute, and which answers are refused.

const NOW = 1_700_000_000_000;
const ACCESS_EXPIRES_IN = 1_800_000;
const REFRESH_EXPIRES_IN = 7_200_000;

const tokenXml = (
  inner = `<AccessToken>ACCESS1</AccessToken><AccessTokenExpiresIn>${ACCESS_EXPIRES_IN}</AccessTokenExpiresIn><RefreshToken>REF1</RefreshToken><RefreshTokenExpiresIn>${REFRESH_EXPIRES_IN}</RefreshTokenExpiresIn>`,
): string =>
  `<?xml version="1.0" encoding="UTF-8"?><Authentication>${inner}<Error>0</Error><Message>Success</Message></Authentication>`;

const setup = (
  res: TransportResponse,
): { deps: TokenExchangeDeps; calls: TransportRequest[] } => {
  const calls: TransportRequest[] = [];
  const transport: Transport = {
    send: (req) => {
      calls.push(req);
      return Promise.resolve(res);
    },
  };
  return {
    calls,
    deps: {
      accessPoint: { host: "h.test" },
      appId: "APP",
      appSecret: "SECRET",
      transport,
      now: () => NOW,
    },
  };
};

const ok = (body = tokenXml()): TransportResponse => ({ status: 200, body });

describe("exchangeToken — POST /v1/token", () => {
  it("posts the form body to the token endpoint", async () => {
    const { deps, calls } = setup(ok());
    await exchangeToken(deps, "oauth_code", "CODE123");

    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("https://h.test/v1/token");
    expect(calls[0].headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const form = new URLSearchParams(calls[0].body);
    expect(Object.fromEntries(form)).toEqual({
      app_id: "APP",
      secret: "SECRET",
      grant_type: "oauth_code",
      code: "CODE123",
    });
  });

  it("keeps the App Secret out of the URL (ADR-0034 SD-9)", async () => {
    // The secret rides the body and only the body — a URL reaches proxies, logs and history.
    const { deps, calls } = setup(ok());
    await exchangeToken(deps, "oauth_code", "CODE123");
    expect(calls[0].url).not.toContain("SECRET");
    expect(calls[0].body).toContain("secret=SECRET");
  });

  it("sends the grant type it was given (refresh renews, not re-authorises)", async () => {
    const { deps, calls } = setup(ok());
    await exchangeToken(deps, "refresh_token", "REF1");
    expect(calls[0].body).toContain("grant_type=refresh_token");
  });

  it("converts the relative expiry (ms) to an absolute epoch at receipt (ADR-0012)", async () => {
    const { deps } = setup(ok());
    const tokens = await exchangeToken(deps, "oauth_code", "CODE123");
    expect(tokens).toEqual({
      accessToken: "ACCESS1",
      refreshToken: "REF1",
      accessTokenExpiresAt: NOW + ACCESS_EXPIRES_IN,
      refreshTokenExpiresAt: NOW + REFRESH_EXPIRES_IN,
    });
  });

  it("treats a missing expiry as already expired rather than as forever", async () => {
    // No `*ExpiresIn` -> offset 0 -> expires at `now`, so the next call re-acquires (fail-safe).
    const { deps } = setup(
      ok(
        tokenXml(`<AccessToken>A</AccessToken><RefreshToken>R</RefreshToken>`),
      ),
    );
    const tokens = await exchangeToken(deps, "oauth_code", "CODE123");
    expect(tokens.accessTokenExpiresAt).toBe(NOW);
    expect(tokens.refreshTokenExpiresAt).toBe(NOW);
  });

  it("rejects an envelope without an access token", async () => {
    const { deps } = setup(ok(tokenXml(`<RefreshToken>R</RefreshToken>`)));
    await expect(exchangeToken(deps, "oauth_code", "CODE123")).rejects.toThrow(
      PortersAuthError,
    );
  });

  it("rejects an envelope without a refresh token", async () => {
    const { deps } = setup(ok(tokenXml(`<AccessToken>A</AccessToken>`)));
    await expect(
      exchangeToken(deps, "oauth_code", "CODE123"),
    ).rejects.toMatchObject({ category: "auth" });
  });

  it("classifies a gateway 5xx by its status, not as an unparseable envelope (ADR-0050)", async () => {
    // A proxy's HTML error page sits in front of every request the library makes; reading only the
    // envelope would report `unknown` + not retryable right at the front door.
    const { deps } = setup({ status: 503, body: "<html>bad gateway</html>" });
    const error: unknown = await exchangeToken(deps, "oauth_code", "C").catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PortersError);
    expect((error as PortersError).httpStatus).toBe(503);
    expect((error as PortersError).category).not.toBe("unknown");
  });
});
