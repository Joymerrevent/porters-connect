// Token management owned by the client, whichever provider obtains the tokens (ADR-0091 案1a).
// Cache, expiry decisions (proactive margin + reactive 401/402), renewal via refresh or acquire,
// in-process single-flight, and persistence to the token store (ADR-0012, widened to every
// provider). Factory style per ADR-0013.

import { PortersConfigError } from "../errors/index";
import { createMemoryTokenStore } from "./memory-token-store";
import type { AccessTokenSource } from "../http/index";
import type {
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
  /** The usable Access Token with its expiry (renewed first when due) — what `getToken()` returns. */
  getIssuedToken(): Promise<IssuedToken>;
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
  // typeof は型を絞るためだけ（Number.isFinite は数値以外に false を返すので、結果は変わらない）。
  // Stryker disable next-line ConditionalExpression: equivalent — Number.isFinite already rejects every non-number
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
  let loading: Promise<void> | undefined;
  let inflight: Promise<StoredTokens> | undefined;
  // 手元のトークンを入れ替えた（cache / clear）回数。読み込みや取り直しを待つ間に入れ替わったら、
  // 待っていた側の結果で上書きしない（RV-91・RV-121）。
  let generation = 0;

  // An unknown expiry counts as usable: the reactive 401/402 retry is the backstop.
  const usable = (t: IssuedToken): boolean =>
    t.expiresAt === undefined || now() < t.expiresAt - margin;

  // 世代は「変わったか」だけを比べるので、増やすか減らすかは結果に効かない。
  const save = async (tokens: StoredTokens): Promise<StoredTokens> => {
    // Stryker disable next-line AssignmentOperator: equivalent — only a change of generation is compared
    generation += 1;
    cached = tokens;
    await store.set(tokens);
    return tokens;
  };

  // Read the store once, on the first need, so a restart reuses what another run saved. Calls that
  // arrive while it is being read wait for the same read, rather than going on to acquire a token
  // the store already has (RV-75). A failed read is not remembered: the next call reads again.
  const load = (): Promise<void> =>
    (loading ??= (async () => {
      // 手元にあれば読まない（保存先が止まっていても、cache() で入れたトークンを使える）。
      if (cached !== undefined) return;
      const before = generation;
      const stored = readStoredTokens(await store.get());
      // 読んでいる間に cache / clear が入れ替えていたら、そちらが新しい。
      if (generation === before) cached = stored;
    })().catch((e: unknown) => {
      loading = undefined;
      throw e;
    }));

  // refresh when it can work: the issuer hands out no refresh token (its own way of renewing), or
  // the refresh token is still usable. Otherwise start over with acquire.
  // 取り直しの間に clear() が呼ばれたら、取れたトークンは手元にも保存先にも戻さない（消したはずの
  // トークンが戻らないように）。走っている取り直しを待つリクエストには、clear() の後に来たものも含めて
  // そのトークンを返す。cache() が呼ばれたときも、そちらを残す。
  const renew = async (): Promise<StoredTokens> => {
    const before = generation;
    const current = cached;
    const tokens =
      provider.refresh !== undefined &&
      current !== undefined &&
      (current.refreshToken === undefined || usable(current.refreshToken))
        ? requireTokens(await provider.refresh(current), "refresh")
        : requireTokens(await provider.acquire(), "acquire");
    return generation === before ? save(tokens) : tokens;
  };

  // `failedToken` is the token a 401 / 402 refused. If the cache already holds another one, a
  // concurrent request renewed it meanwhile: use that instead of renewing again, so N requests
  // refused together cost one renewal, not N (ADR-0012 の single-flight。RV-75).
  const ensure = async (
    forceRefresh: boolean,
    failedToken?: string,
  ): Promise<StoredTokens> => {
    await load();
    const renewedMeanwhile =
      failedToken !== undefined && cached?.accessToken.token !== failedToken;
    if (
      (!forceRefresh || renewedMeanwhile) &&
      cached !== undefined &&
      usable(cached.accessToken)
    )
      return cached;
    return (inflight ??= renew().finally(() => {
      inflight = undefined;
    }));
  };

  return {
    getAccessToken: async (o) =>
      (await ensure(o?.forceRefresh ?? false, o?.failedToken)).accessToken
        .token,
    // 写しを返す: 受け取った側が書き換えても、キャッシュの値（リクエストに使う値）は変わらない。
    getIssuedToken: async () => ({ ...(await ensure(false)).accessToken }),
    cache: async (tokens) => {
      await save(requireTokens(tokens, "exchange"));
    },
    clear: async () => {
      // Stryker disable next-line AssignmentOperator: equivalent — only a change of generation is compared
      generation += 1;
      cached = undefined;
      await store.clear();
    },
  };
};
