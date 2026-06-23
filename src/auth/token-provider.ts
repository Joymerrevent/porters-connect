// Default transparent TokenProvider (ADR-0007 / ADR-0012): code_direct -> token,
// cache, hybrid refresh (proactive margin + on-demand), in-process single-flight.
// Factory style per ADR-0013. Exposes internal cache/clear so the public auth API
// (ADR-0034 F-1) can save a browser-`code` exchange and locally forget tokens.

import { PortersAuthError } from "../errors/index";
import type { Transport } from "../http/index";
import { parseAuthentication } from "../xml/parser";
import { createMemoryTokenStore } from "./memory-store";
import { exchangeToken } from "./token-exchange";
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

/**
 * The default provider plus internal controls used by the public auth API
 * (ADR-0034 SD-8): {@link DefaultTokenProvider.cache} saves externally-acquired
 * tokens (browser `code` exchange) to the in-memory cache + token store;
 * {@link DefaultTokenProvider.clear} forgets them (local revoke). Deliberately *not*
 * part of the public
 * {@link TokenProvider} contract — a custom strategy supplies neither.
 */
export type DefaultTokenProvider = TokenProvider & {
  cache(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
};

const DEFAULT_MARGIN_MS = 60_000;

export const createDefaultTokenProvider = (
  opts: DefaultTokenProviderOptions,
): DefaultTokenProvider => {
  const store = opts.tokenStore ?? createMemoryTokenStore();
  const margin = opts.refreshMarginMs ?? DEFAULT_MARGIN_MS;
  const now = opts.now ?? (() => Date.now());

  let cached: StoredTokens | undefined;
  let inflight: Promise<StoredTokens> | undefined;

  const accessValid = (t: StoredTokens | undefined): t is StoredTokens =>
    t !== undefined && now() < t.accessTokenExpiresAt - margin;

  const canRefresh = (t: StoredTokens | undefined): t is StoredTokens =>
    t !== undefined && now() < t.refreshTokenExpiresAt - margin;

  // Cache + persist freshly minted tokens so the next call (and other instances) reuse them.
  const save = async (tokens: StoredTokens): Promise<StoredTokens> => {
    cached = tokens;
    await store.set(tokens);
    return tokens;
  };

  const exchange = async (
    grantType: "oauth_code" | "refresh_token",
    code: string,
  ): Promise<StoredTokens> =>
    save(
      await exchangeToken(
        {
          host: opts.host,
          appId: opts.appId,
          appSecret: opts.appSecret,
          transport: opts.transport,
          now,
        },
        grantType,
        code,
      ),
    );

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
    cache: async (tokens) => {
      await save(tokens);
    },
    clear: async () => {
      cached = undefined;
      await store.clear();
    },
  };
};
