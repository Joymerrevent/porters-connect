// Shared OAuth token exchange against `POST /v1/token` (ADR-0034 F-1 / ADR-0007).
// Used by both the default transparent provider (code_direct grant) and the public
// auth API's browser `code` exchange — they POST the same form and parse the same
// <Authentication> envelope, so the logic lives here once. The App Secret only ever
// rides the POST body (ADR-0034 SD-9), never a URL/log.

import { PortersAuthError } from "../errors/index";
import type { Transport } from "../http/index";
import { parseAuthentication } from "../xml/parser";
import type { StoredTokens } from "./types";

/** Credentials + seams shared by every token exchange. */
export type TokenExchangeDeps = {
  host: string;
  appId: string;
  appSecret: string;
  transport: Transport;
  /** Clock for converting relative expiry (ms) to an absolute epoch (ADR-0012). */
  now: () => number;
};

/** OAuth grant kinds the Token endpoint accepts (token.md). */
export type TokenGrantType = "oauth_code" | "refresh_token";

/**
 * Exchange an OAuth `code` (new grant) or a Refresh Token (renewal) for tokens via
 * `POST {host}/v1/token`. The relative `*ExpiresIn` (ms) is converted to an absolute
 * epoch at receipt (clock-skew tolerant — ADR-0012). Throws {@link PortersAuthError}
 * when the envelope reports an error (`<Error>≠0`, via the parser) or omits a token.
 */
export const exchangeToken = async (
  deps: TokenExchangeDeps,
  grantType: TokenGrantType,
  code: string,
): Promise<StoredTokens> => {
  const body = new URLSearchParams({
    app_id: deps.appId,
    secret: deps.appSecret,
    grant_type: grantType,
    code,
  }).toString();
  const res = await deps.transport.send({
    method: "POST",
    url: `https://${deps.host}/v1/token`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const a = parseAuthentication(res.body);
  if (a.accessToken === undefined || a.refreshToken === undefined) {
    throw new PortersAuthError("token response missing tokens", {
      category: "auth",
    });
  }
  return {
    accessToken: a.accessToken,
    refreshToken: a.refreshToken,
    accessTokenExpiresAt: deps.now() + (a.accessTokenExpiresIn ?? 0),
    refreshTokenExpiresAt: deps.now() + (a.refreshTokenExpiresIn ?? 0),
  };
};
