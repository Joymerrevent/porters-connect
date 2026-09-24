// Token management owned by the client, whichever provider obtains the tokens (ADR-0091 案1a).
// Cache, expiry decisions (proactive margin + reactive 401/402), renewal via refresh or acquire,
// in-process single-flight, and persistence to the token store (ADR-0012, widened to every
// provider). Factory style per ADR-0013.

import { PortersConfigError } from "../errors/index";
import { createMemoryTokenStore } from "./memory-store";
import type {
  AccessTokenSource,
  IssuedToken,
  StoredTokens,
  TokenProvider,
  TokenStore,
} from "./types";

export type TokenManagerOptions = {
  provider: TokenProvider;
  /** Token persistence; defaults to in-memory. */
  tokenStore?: TokenStore;
  /** Renew this many ms before a known expiry (proactive). Default 60s. */
  refreshMarginMs?: number;
  /** Injectable clock (tests). Default `Date.now`. */
  now?: () => number;
};

/** The request pipeline's token source, plus the save/forget controls behind `porters.auth`. */
export type TokenManager = AccessTokenSource & {
  /** Validate and save tokens obtained outside renewal (the browser `code` exchange). */
  cache(tokens: unknown): Promise<void>;
  /** Forget the cached and stored tokens (local only; the issuer's tokens stay valid). */
  clear(): Promise<void>;
};

const DEFAULT_MARGIN_MS = 60_000;

// 期限は「有限の数値」だけを信じ、それ以外は期限不明に倒す（ADR-0091「信じている入力」）。
const readIssued = (value: unknown): IssuedToken | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const { token, expiresAt } = value as {
    token?: unknown;
    expiresAt?: unknown;
  };
  if (typeof token !== "string" || token === "") return undefined;
  return typeof expiresAt === "number" && Number.isFinite(expiresAt)
    ? { token, expiresAt }
    : { token };
};

/**
 * Normalise a token set, or `undefined` when it is not one. A store may hold anything — an older
 * shape written before ADR-0091, or data another process mangled — and that must read as
 * "nothing stored" (re-obtain) rather than crash every request.
 */
export const readStoredTokens = (value: unknown): StoredTokens | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as { accessToken?: unknown; refreshToken?: unknown };
  const accessToken = readIssued(v.accessToken);
  if (accessToken === undefined) return undefined;
  const refreshToken = readIssued(v.refreshToken);
  return refreshToken === undefined
    ? { accessToken }
    : { accessToken, refreshToken };
};

// A provider's answer is checked before it is used or stored: an empty or non-string token is an
// error the library can see before sending anything (ADR-0046 の送信前ガードと同じ考え).
const requireTokens = (value: unknown, from: string): StoredTokens => {
  const tokens = readStoredTokens(value);
  if (tokens === undefined) {
    throw new PortersConfigError(
      `tokenProvider.${from} returned no usable access token`,
      {
        category: "config",
        hint: "Return { accessToken: { token, expiresAt? } } with a non-empty token string (expiresAt in epoch ms, optional).",
      },
    );
  }
  return tokens;
};

export const createTokenManager = (opts: TokenManagerOptions): TokenManager => {
  const { provider } = opts;
  const store = opts.tokenStore ?? createMemoryTokenStore();
  const margin = opts.refreshMarginMs ?? DEFAULT_MARGIN_MS;
  const now = opts.now ?? (() => Date.now());

  let cached: StoredTokens | undefined;
  let loaded = false;
  let inflight: Promise<StoredTokens> | undefined;

  // An unknown expiry counts as usable: the reactive 401/402 retry is the backstop.
  const usable = (t: IssuedToken | undefined): boolean =>
    t !== undefined &&
    (t.expiresAt === undefined || now() < t.expiresAt - margin);

  const save = async (tokens: StoredTokens): Promise<StoredTokens> => {
    cached = tokens;
    await store.set(tokens);
    return tokens;
  };

  // Read the store once, on the first need, so a restart reuses what another run saved.
  const load = async (): Promise<void> => {
    if (loaded) return;
    loaded = true;
    if (cached === undefined) cached = readStoredTokens(await store.get());
  };

  // refresh when it can work: the issuer hands out no refresh token (its own way of renewing), or
  // the refresh token is still usable. Otherwise start over with acquire.
  const renew = async (): Promise<StoredTokens> => {
    const current = cached;
    if (
      provider.refresh !== undefined &&
      current !== undefined &&
      (current.refreshToken === undefined || usable(current.refreshToken))
    ) {
      return save(requireTokens(await provider.refresh(current), "refresh"));
    }
    return save(requireTokens(await provider.acquire(), "acquire"));
  };

  const ensure = async (forceRefresh: boolean): Promise<StoredTokens> => {
    await load();
    if (!forceRefresh && cached !== undefined && usable(cached.accessToken))
      return cached;
    return (inflight ??= renew().finally(() => {
      inflight = undefined;
    }));
  };

  return {
    getAccessToken: async (o) =>
      (await ensure(o?.forceRefresh ?? false)).accessToken.token,
    cache: async (tokens) => {
      loaded = true;
      await save(requireTokens(tokens, "exchange"));
    },
    clear: async () => {
      cached = undefined;
      loaded = true;
      await store.clear();
    },
  };
};
