// Authentication seam (ADR-0007). Default strategy is transparent code_direct
// with caching + hybrid refresh; custom strategies can take full control.

/** Options for {@link TokenProvider.getAccessToken}. */
export type GetAccessTokenOptions = {
  /** Force a refresh even if the cached token looks valid (reactive 401/402). */
  forceRefresh?: boolean;
};

/** Supplies a valid Access Token, refreshing transparently when expired. */
export type TokenProvider = {
  getAccessToken(opts?: GetAccessTokenOptions): Promise<string>;
};

/** Tokens persisted by a {@link TokenStore} (expiry is absolute epoch ms). */
export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};

/**
 * Pluggable token persistence (default: in-memory). Async so it can back onto
 * redis / DB / file for multi-instance server use.
 */
export type TokenStore = {
  get(): Promise<StoredTokens | undefined>;
  set(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
};

export { createDefaultTokenProvider } from "./token-provider";
export type { DefaultTokenProviderOptions } from "./token-provider";
export { createMemoryTokenStore } from "./memory-store";
