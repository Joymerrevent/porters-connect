// Default transparent TokenProvider (ADR-0007 / ADR-0012): code_direct -> token,
// cache, hybrid refresh (proactive margin + on-demand), in-process single-flight.
// Factory style per ADR-0013.

import { PortersAuthError } from "../errors/index";
import type { Transport } from "../http/index";
import { parseAuthentication } from "../xml/parser";
import { createMemoryTokenStore } from "./memory-store";
import type { StoredTokens, TokenProvider, TokenStore } from "./types";

export type DefaultTokenProviderOptions = {
  host: string;
  appId: string;
  appSecret: string;
  transport: Transport;
  /** Token persistence; defaults to in-memory. */
  tokenStore?: TokenStore;
  /** Refresh this many ms before expiry (proactive). Default 60s. */
  refreshMarginMs?: number;
  /** Injectable clock (tests). Default `Date.now`. */
  now?: () => number;
};

const DEFAULT_MARGIN_MS = 60_000;

export const createDefaultTokenProvider = (
  opts: DefaultTokenProviderOptions,
): TokenProvider => {
  const store = opts.tokenStore ?? createMemoryTokenStore();
  const margin = opts.refreshMarginMs ?? DEFAULT_MARGIN_MS;
  const now = opts.now ?? (() => Date.now());

  let cached: StoredTokens | undefined;
  let inflight: Promise<StoredTokens> | undefined;

  const accessValid = (t: StoredTokens | undefined): t is StoredTokens =>
    t !== undefined && now() < t.accessTokenExpiresAt - margin;

  const canRefresh = (t: StoredTokens | undefined): t is StoredTokens =>
    t !== undefined && now() < t.refreshTokenExpiresAt - margin;

  const exchange = async (
    grantType: "oauth_code" | "refresh_token",
    code: string,
  ): Promise<StoredTokens> => {
    const body = new URLSearchParams({
      app_id: opts.appId,
      secret: opts.appSecret,
      grant_type: grantType,
      code,
    }).toString();
    const res = await opts.transport.send({
      method: "POST",
      url: `https://${opts.host}/v1/token`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const a = parseAuthentication(res.body);
    if (a.accessToken === undefined || a.refreshToken === undefined) {
      throw new PortersAuthError("token response missing tokens", {
        category: "auth",
      });
    }
    const t: StoredTokens = {
      accessToken: a.accessToken,
      refreshToken: a.refreshToken,
      accessTokenExpiresAt: now() + (a.accessTokenExpiresIn ?? 0),
      refreshTokenExpiresAt: now() + (a.refreshTokenExpiresIn ?? 0),
    };
    cached = t;
    await store.set(t);
    return t;
  };

  // code_direct -> token (initial acquisition; requires prior browser grant).
  const acquire = async (): Promise<StoredTokens> => {
    const url =
      `https://${opts.host}/v1/oauth` +
      `?app_id=${encodeURIComponent(opts.appId)}&response_type=code_direct`;
    const res = await opts.transport.send({ method: "GET", url, headers: {} });
    const { code } = parseAuthentication(res.body);
    if (code === undefined) {
      throw new PortersAuthError("code_direct returned no code", {
        category: "auth",
      });
    }
    return exchange("oauth_code", code);
  };

  const renew = async (): Promise<StoredTokens> => {
    if (cached === undefined) cached = await store.get();
    if (canRefresh(cached)) {
      return exchange("refresh_token", cached.refreshToken);
    }
    return acquire();
  };

  const ensure = (forceRefresh: boolean): Promise<StoredTokens> => {
    if (!forceRefresh && accessValid(cached)) return Promise.resolve(cached);
    return (inflight ??= renew().finally(() => {
      inflight = undefined;
    }));
  };

  return {
    getAccessToken: async (o) =>
      (await ensure(o?.forceRefresh ?? false)).accessToken,
  };
};
