// Authentication seam (ADR-0007). Default strategy is transparent code_direct
// with caching + refresh; custom strategies can take full control.

/** Supplies a valid Access Token, refreshing transparently when expired. */
export interface TokenProvider {
  getAccessToken(): Promise<string>;
}

/** Tokens persisted by a {@link TokenStore}. */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Pluggable token persistence (default: in-memory). Async so it can back onto
 * redis / DB / file for multi-instance server use.
 */
export interface TokenStore {
  get(): Promise<StoredTokens | undefined>;
  set(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
}
