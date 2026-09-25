// Public OAuth surface `porters.auth.*` (ADR-0034 F-1 / ADR-0007 SD-3/SD-6). A thin
// facade over the token provider and the client's token manager: it builds the browser
// `code` / `remove` URLs, exchanges a redirect `?code=` through the provider's `exchange` and saves
// the result, warms up / inspects the token, and locally forgets tokens. Every method works with
// any provider that supplies what it needs (ADR-0091) — there is no "default strategy only" method
// any more. Factory style per ADR-0013; the App Secret never leaves the Token POST body (SD-9).

import { PortersConfigError } from "../errors/index";
import { apiUrl, type AccessPoint } from "../http/index";
import type { TokenManager } from "./token-manager";
import type { IssuedToken, Scope, TokenProvider } from "./types";

/** Shared options for the browser `code` / `remove` OAuth URLs (docs/usage/reference/authentication-api/oauth.md). */
export type AuthorizationUrlOptions = {
  /** Registered Redirect URL the browser returns to (required for code/remove). */
  redirectUrl: string;
  /** Scopes to grant/remove; defaults to the client's configured `scopes`. */
  scopes?: Scope[];
  /** Opaque value echoed back on redirect (e.g. CSRF defense). */
  state?: string;
};

/** Options for the `remove` (de-authorization) browser URL. */
export type RevokeUrlOptions = AuthorizationUrlOptions;

// 公開メソッドの範囲は ADR-0007 SD-3 / SD-6。
/**
 * The `porters.auth.*` surface. The initial per-Company-DB grant
 * needs a human to open {@link AuthApi.authorizationUrl} in a browser and consent; the
 * library only builds the URL and exchanges the returned `code`. Day-to-day token
 * acquisition and renewal are handled by the client, whichever token provider is in use, so
 * most callers never touch this surface.
 */
export type AuthApi = {
  /** Build the browser `code`-grant URL to open for the initial permission grant. */
  authorizationUrl(opts: AuthorizationUrlOptions): string;
  /**
   * Exchange a redirect `?code=` for tokens through the token provider's `exchange`, and save
   * them (cache and `tokenStore`). Resolves `void` on success (inspect via
   * {@link AuthApi.getToken}); rejects with {@link PortersConfigError} when the provider has no
   * `exchange` or the built-in one lacks `appId` / `appSecret`, `PortersAuthError` (token-endpoint
   * error or expired code), or `PortersNetworkError`.
   */
  exchangeAuthorizationCode(code: string): Promise<void>;
  /**
   * Build the browser `remove`-grant URL to open for server-side de-authorization.
   * PORTERS has no server-to-server removal, so completing it stays a browser step;
   * pair with {@link AuthApi.clearTokens} to drop the local copy.
   */
  revokeUrl(opts: RevokeUrlOptions): string;
  /** Forget cached + stored tokens locally. Does not de-authorize server-side. */
  clearTokens(): Promise<void>;
  /** Acquire a token now (startup fail-fast / warm-up); throws if auth is unavailable. */
  ensureAuthenticated(): Promise<void>;
  // 期限も返すのは ADR-0093（中央のサービスが各アプリへ期限つきで渡せるように）。
  /**
   * The Access Token the client currently uses, with its expiry — renewed first when it is within
   * the refresh margin, exactly as a request would. `expiresAt` is epoch milliseconds, or absent
   * when the token provider did not report one. Use it to hand the token to another process (for
   * example, a central service answering its apps' `tokenProvider.acquire`). The Refresh Token is
   * never exposed.
   */
  getToken(): Promise<IssuedToken>;
};

export type AuthApiOptions = {
  accessPoint: AccessPoint;
  appId?: string;
  scopes?: Scope[];
  /** Where tokens come from (built-in or the caller's `tokenProvider`). */
  provider: TokenProvider;
  /** The client's cache / renewal / persistence, shared with the request pipeline. */
  manager: TokenManager;
};

export const createAuthApi = (opts: AuthApiOptions): AuthApi => {
  const requireAppId = (): string => {
    if (!opts.appId) {
      throw new PortersConfigError("appId is required to build an OAuth URL", {
        category: "config",
        hint: "Set appId on PortersClient: the browser grant URL names the App.",
      });
    }
    return opts.appId;
  };

  const resolveScopes = (scopes: Scope[] | undefined): Scope[] => {
    const resolved = scopes ?? opts.scopes ?? [];
    if (resolved.length === 0) {
      throw new PortersConfigError(
        "at least one scope is required for the code/remove grant",
        {
          category: "config",
          hint: "Pass `scopes` to this call or configure `scopes` on PortersClient.",
        },
      );
    }
    return resolved;
  };

  const buildOAuthUrl = (
    responseType: "code" | "remove",
    o: AuthorizationUrlOptions,
  ): string => {
    const params = new URLSearchParams({
      app_id: requireAppId(),
      redirect_url: o.redirectUrl,
      response_type: responseType,
      scope: resolveScopes(o.scopes).join(","),
    });
    if (o.state !== undefined) params.set("state", o.state);
    return apiUrl(opts.accessPoint, "oauth", params);
  };

  return {
    authorizationUrl: (o) => buildOAuthUrl("code", o),
    revokeUrl: (o) => buildOAuthUrl("remove", o),
    exchangeAuthorizationCode: async (code) => {
      // 交換も更新も同じ tokenProvider が行う＝別の発行元のトークンが混ざらない（ADR-0091）。
      if (opts.provider.exchange === undefined) {
        throw new PortersConfigError(
          "exchangeAuthorizationCode needs a tokenProvider with exchange(code)",
          {
            category: "config",
            hint: "Implement exchange(code) on your tokenProvider (for example, forward the code to the service that holds the App Secret). A code expires 30 seconds after it is issued.",
          },
        );
      }
      await opts.manager.cache(await opts.provider.exchange(code));
    },
    clearTokens: async () => {
      await opts.manager.clear();
    },
    ensureAuthenticated: async () => {
      await opts.manager.getAccessToken();
    },
    // `async` so a provider that throws synchronously still reaches the caller as a
    // rejection — a Promise-returning method never throws (ADR-0046).
    getToken: async () => opts.manager.getIssuedToken(),
  };
};
