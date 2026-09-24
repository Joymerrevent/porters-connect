// Authentication seam types (ADR-0007 案4, reshaped by ADR-0091). A token provider only
// *obtains* tokens; caching, expiry decisions, single-flight and persistence belong to the
// client (the token manager), whichever provider is in use.

/** One token and, when known, its absolute expiry (epoch ms). No `expiresAt` means "unknown". */
export type IssuedToken = {
  token: string;
  expiresAt?: number;
};

/**
 * Tokens as obtained from a {@link TokenProvider} and persisted by a {@link TokenStore}.
 * `refreshToken` is present only when the issuer hands one out; a value and its expiry always
 * travel together.
 */
export type StoredTokens = {
  accessToken: IssuedToken;
  refreshToken?: IssuedToken;
};

// 取得だけを差し替える形は ADR-0091（案3a）。管理はクライアント側の token manager。
/**
 * Where tokens come from. Pass one as `tokenProvider` to obtain tokens elsewhere (for example
 * from a central service that holds the App Secret); leave it out for the built-in `code_direct`
 * flow. The client caches what these return, renews shortly before expiry, retries once on an
 * expired-token response, collapses concurrent renewals into one, and saves to `tokenStore`.
 */
export type TokenProvider = {
  /** Obtain tokens from scratch. Called first, and whenever renewal is not possible. */
  acquire(): Promise<StoredTokens>;
  /**
   * Renew tokens. Called instead of {@link TokenProvider.acquire} while `current.refreshToken`
   * is usable — or, when the issuer hands out no refresh token, whenever renewal is needed.
   * Leave it out to renew by calling `acquire` again.
   */
  refresh?(current: StoredTokens): Promise<StoredTokens>;
  /**
   * Exchange an authorization `code` returned to your redirect URL after the browser grant.
   * Needed only for `porters.auth.exchangeAuthorizationCode`. PORTERS expires a `code` 30 seconds
   * after issuing it, so do not do slow work here.
   */
  exchange?(code: string): Promise<StoredTokens>;
};

/**
 * Pluggable token persistence (default: in-memory). Async so it can back onto
 * redis / DB / file for multi-instance server use. Used with every token provider.
 */
export type TokenStore = {
  get(): Promise<StoredTokens | undefined>;
  set(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
};

/**
 * Internal: what the request pipeline asks for a token. `forceRefresh` is set after an
 * expired-token response (401/402). Not part of the published API.
 */
export type AccessTokenSource = {
  getAccessToken(opts?: { forceRefresh?: boolean }): Promise<string>;
};
