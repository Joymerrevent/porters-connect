// The built-in token provider (ADR-0007 / ADR-0091): obtains tokens the PORTERS way —
// `code_direct` -> Token API for a fresh start, the refresh-token grant for renewal, and the
// browser `code` exchange for the initial grant. It only *obtains*; caching, expiry decisions,
// single-flight and persistence are the token manager's (`token-manager.ts`). Factory per ADR-0013.

import { PortersAuthError, PortersConfigError } from "../errors/index";
import {
  apiUrl,
  readResponse,
  type AccessPoint,
  type Transport,
} from "../http/index";
import { parseAuthentication } from "../xml/parse-authentication";
import { exchangeToken, type TokenGrantType } from "./exchange-token";
import type { StoredTokens, TokenProvider } from "./types";

// PORTERS が Refresh Token を受け付けないときの認証エラー: 401 = 期限切れ、107 = 無効（別のプロセスが先に
// 更新して、手元の Refresh Token が古くなったときもこれになる）。どちらも code_direct からやり直せば回復する
// （ADR-0036: Refresh Token が失効したら code_direct で取り直し、PortersAuthError は code_direct 自体の失敗だけ）。
// 手元の期限だけで判断すると、期限より前に拒否されたときに同じ refresh を繰り返して止まる。
const REFRESH_REJECTED: ReadonlySet<number | null> = new Set([401, 107]);

export type DefaultTokenProviderOptions = {
  accessPoint: AccessPoint;
  /** Needed by every step; missing values fail when a token is first needed, not at construction. */
  appId?: string;
  appSecret?: string;
  transport: Transport;
  /** Injectable clock (tests). Default `Date.now`. */
  now?: () => number;
};

export const createDefaultTokenProvider = (
  opts: DefaultTokenProviderOptions,
): Required<TokenProvider> => {
  const now = opts.now ?? (() => Date.now());

  // The App Secret only ever rides the Token POST body (ADR-0034 SD-9).
  const credentials = (): { appId: string; appSecret: string } => {
    if (!opts.appId || !opts.appSecret) {
      throw new PortersConfigError(
        "appId and appSecret are required to obtain a token",
        {
          category: "config",
          hint: "Set appId/appSecret on PortersClient, or pass a tokenProvider that obtains tokens another way.",
        },
      );
    }
    return { appId: opts.appId, appSecret: opts.appSecret };
  };

  const exchange = (
    grantType: TokenGrantType,
    code: string,
  ): Promise<StoredTokens> =>
    exchangeToken(
      {
        accessPoint: opts.accessPoint,
        transport: opts.transport,
        now,
        ...credentials(),
      },
      grantType,
      code,
    );

  // code_direct -> token (a fresh start; requires the one-time browser grant).
  const acquire = async (): Promise<StoredTokens> => {
    const { appId } = credentials();
    const url = apiUrl(
      opts.accessPoint,
      "oauth",
      new URLSearchParams({ app_id: appId, response_type: "code_direct" }),
    );
    const res = await opts.transport.send({ method: "GET", url, headers: {} });
    // Same reading as every other response (ADR-0050): an intermediary's 4xx/5xx is classified
    // from the status instead of collapsing into "unparseable authentication response".
    const { code } = readResponse(res, parseAuthentication);
    if (code === undefined) {
      throw new PortersAuthError("code_direct returned no code", {
        category: "auth",
      });
    }
    return exchange("oauth_code", code);
  };

  return {
    acquire,
    // Tokens without a refresh token (read back from a store, say) cannot use the grant: start over.
    refresh: async (current) => {
      if (current.refreshToken === undefined) return acquire();
      try {
        return await exchange("refresh_token", current.refreshToken.token);
      } catch (e) {
        if (e instanceof PortersAuthError && REFRESH_REJECTED.has(e.code))
          return acquire();
        throw e;
      }
    },
    exchange: async (code) => exchange("oauth_code", code),
  };
};
