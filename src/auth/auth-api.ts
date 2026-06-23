// Public OAuth surface `porters.auth.*` (ADR-0034 F-1 / ADR-0007 SD-3/SD-6). A thin
// facade over the active token provider: it builds the browser `code` / `remove` URLs,
// exchanges a redirect `?code=` for tokens (saving them into the default strategy),
// warms up / inspects the token, and locally forgets tokens. Credential- and
// default-strategy-dependent methods fail fast with a PortersConfigError under a custom
// auth strategy (ADR-0034 SD-7). Factory style per ADR-0013; the App Secret never leaves
// the Token POST body (SD-9).

import { PortersConfigError } from "../errors/index";
import type { Transport } from "../http/index";
import type { Scope } from "../types/index";
import { exchangeToken } from "./token-exchange";
import type { StoredTokens, TokenProvider } from "./types";

/** Shared options for the browser `code` / `remove` OAuth URLs (oauth.md). */
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

/**
 * The `porters.auth.*` surface (ADR-0007 SD-3/SD-6). The initial per-Company-DB grant
 * needs a human to open {@link AuthApi.authorizationUrl} in a browser and consent; the
 * library only builds the URL and exchanges the returned `code`. Day-to-day token
 * acquisition/refresh stays transparent (the default strategy), so most callers never
 * touch this surface.
 */
export type AuthApi = {
  /** Build the browser `code`-grant URL to open for the initial permission grant. */
  authorizationUrl(opts: AuthorizationUrlOptions): string;
  /**
   * Exchange a redirect `?code=` for tokens and save them into the default strategy.
   * Resolves `void` on success (tokens are stored internally — inspect via
   * {@link AuthApi.getToken}); throws on failure: {@link PortersConfigError} (missing
   * credentials / custom strategy), `PortersAuthError` (token-endpoint error or expired
   * code), or `PortersNetworkError`.
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
  /** Return the current valid Access Token (debug). The Refresh Token is never exposed. */
  getToken(): Promise<string>;
};

/** Internal save/forget controls, present only when the default provider is in use. */
export type AuthProviderControls = {
  prime(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
};

export type AuthApiOptions = {
  host: string;
  appId?: string;
  appSecret?: string;
  scopes?: Scope[];
  transport: Transport;
  /** The active token provider (default or custom) backing ensure/getToken. */
  provider: TokenProvider;
  /** Present only for the default provider; absent under a custom strategy. */
  controls?: AuthProviderControls;
  /** Injectable clock (tests). Default `Date.now`. */
  now?: () => number;
};

export const createAuthApi = (opts: AuthApiOptions): AuthApi => {
  const now = opts.now ?? (() => Date.now());

  const requireAppId = (): string => {
    if (!opts.appId) {
      throw new PortersConfigError("appId is required to build an OAuth URL", {
        category: "config",
        hint: "Set appId on PortersClient. A custom auth strategy that supplies its own tokens cannot run the browser grant.",
      });
    }
    return opts.appId;
  };

  const requireDefaultStrategy = (method: string): AuthProviderControls => {
    if (opts.controls === undefined) {
      throw new PortersConfigError(
        `${method} is only available with the default auth strategy`,
        {
          category: "config",
          hint: "Remove the custom `auth` strategy to let the library manage tokens, or perform this step in your own strategy.",
        },
      );
    }
    return opts.controls;
  };

  const requireCredentials = (): { appId: string; appSecret: string } => {
    if (!opts.appId || !opts.appSecret) {
      throw new PortersConfigError(
        "appId and appSecret are required to exchange an authorization code",
        {
          category: "config",
          hint: "Set appId/appSecret on PortersClient (the Token endpoint needs both).",
        },
      );
    }
    return { appId: opts.appId, appSecret: opts.appSecret };
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
    return `https://${opts.host}/v1/oauth?${params.toString()}`;
  };

  return {
    authorizationUrl: (o) => buildOAuthUrl("code", o),
    revokeUrl: (o) => buildOAuthUrl("remove", o),
    exchangeAuthorizationCode: async (code) => {
      const controls = requireDefaultStrategy("exchangeAuthorizationCode");
      const { appId, appSecret } = requireCredentials();
      const tokens = await exchangeToken(
        { host: opts.host, appId, appSecret, transport: opts.transport, now },
        "oauth_code",
        code,
      );
      await controls.prime(tokens);
    },
    clearTokens: async () => {
      const controls = requireDefaultStrategy("clearTokens");
      await controls.clear();
    },
    ensureAuthenticated: async () => {
      await opts.provider.getAccessToken();
    },
    getToken: () => opts.provider.getAccessToken(),
  };
};
