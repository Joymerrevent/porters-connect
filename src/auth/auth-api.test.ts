import { describe, expect, it } from "vitest";

import { PortersAuthError, PortersConfigError } from "../errors/index";
import type { Transport, TransportRequest } from "../http/index";
import { createAuthApi } from "./auth-api";
import { createTokenManager } from "./token-manager";
import { createDefaultTokenProvider } from "./default-token-provider";
import type { Scope, TokenProvider } from "./types";

const ACCESS_EXPIRES_IN = 1_800_000;
const REFRESH_EXPIRES_IN = 7_200_000;

const tokenXml = (access: string): string =>
  `<Authentication><AccessToken>${access}</AccessToken><AccessTokenExpiresIn>${ACCESS_EXPIRES_IN}</AccessTokenExpiresIn><RefreshToken>REF</RefreshToken><RefreshTokenExpiresIn>${REFRESH_EXPIRES_IN}</RefreshTokenExpiresIn><Error>0</Error></Authentication>`;

const CODE_DIRECT_XML = `<Authentication><Code>CD</Code><Error>0</Error></Authentication>`;

// oauth (code_direct) + token transport, recording every request.
const recording = (
  body: (req: TransportRequest) => { status?: number; body: string },
): { transport: Transport; calls: TransportRequest[] } => {
  const calls: TransportRequest[] = [];
  const transport: Transport = {
    send: (req) => {
      calls.push(req);
      const r = body(req);
      return Promise.resolve({ status: r.status ?? 200, body: r.body });
    },
  };
  return { transport, calls };
};

const defaultBodies = (req: TransportRequest): { body: string } =>
  req.url.includes("/v1/oauth")
    ? { body: CODE_DIRECT_XML }
    : { body: tokenXml(req.body?.includes("oauth_code") ? "BROWSER_A" : "A") };

const dummyTransport: Transport = {
  send: () => Promise.reject(new Error("transport should not be called")),
};

const oauthCalls = (calls: TransportRequest[]): TransportRequest[] =>
  calls.filter((c) => c.url.includes("/v1/oauth"));
const tokenCalls = (calls: TransportRequest[]): TransportRequest[] =>
  calls.filter((c) => c.url.includes("/v1/token"));

type Over = { appId?: string; appSecret?: string; scopes?: Scope[] };

// The auth API over the built-in provider and a token manager, as the client wires it. `over`
// keys use presence (`in`) so a test can force a value to `undefined`.
const withDefault = (transport: Transport, over: Over = {}) => {
  const appId = "appId" in over ? over.appId : "app";
  const provider = createDefaultTokenProvider({
    accessPoint: { hostname: "example.test" },
    appId,
    appSecret: "appSecret" in over ? over.appSecret : "secret",
    transport,
    now: () => 1000,
  });
  return createAuthApi({
    accessPoint: { hostname: "example.test" },
    appId,
    scopes: "scopes" in over ? over.scopes : ["candidate_r"],
    provider,
    manager: createTokenManager({ provider, now: () => 1000 }),
  });
};

describe("createAuthApi — authorizationUrl / revokeUrl (ADR-0034 SD-2/SD-4)", () => {
  it("builds the browser code-grant URL with all params", () => {
    const auth = withDefault(dummyTransport, {
      scopes: ["candidate_r", "candidate_w"],
    });
    const url = new URL(
      auth.authorizationUrl({
        redirectUrl: "https://app.example.com/cb",
        state: "xyz",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://example.test/v1/oauth");
    expect(url.searchParams.get("app_id")).toBe("app");
    expect(url.searchParams.get("redirect_url")).toBe(
      "https://app.example.com/cb",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("candidate_r,candidate_w");
    expect(url.searchParams.get("state")).toBe("xyz");
  });

  it("never includes the app secret", () => {
    const auth = withDefault(dummyTransport);
    expect(auth.authorizationUrl({ redirectUrl: "https://x" })).not.toContain(
      "secret",
    );
  });

  it("omits state when not given", () => {
    const auth = withDefault(dummyTransport);
    const url = new URL(auth.authorizationUrl({ redirectUrl: "https://x" }));
    expect(url.searchParams.has("state")).toBe(false);
  });

  it("per-call scopes override the configured default", () => {
    const auth = withDefault(dummyTransport);
    const url = new URL(
      auth.authorizationUrl({ redirectUrl: "https://x", scopes: ["job_r"] }),
    );
    expect(url.searchParams.get("scope")).toBe("job_r");
  });

  it("revokeUrl uses response_type=remove", () => {
    const auth = withDefault(dummyTransport);
    const url = new URL(auth.revokeUrl({ redirectUrl: "https://x" }));
    expect(url.searchParams.get("response_type")).toBe("remove");
  });

  // The class alone is not the contract: a caller branches on `category` (ADR-0006), so each
  // configuration error pins it — a `{}` options object would compile and lose it silently.
  it("throws PortersConfigError (category config) when no scope is available", () => {
    const auth = withDefault(dummyTransport, { scopes: undefined });
    expect(() => auth.authorizationUrl({ redirectUrl: "https://x" })).toThrow(
      PortersConfigError,
    );
    expect(() => auth.authorizationUrl({ redirectUrl: "https://x" })).toThrow(
      expect.objectContaining({
        category: "config",
        message: expect.stringContaining("at least one scope") as string,
        hint: expect.stringContaining("`scopes`") as string,
      }),
    );
  });

  it("throws PortersConfigError (category config) when appId is missing", () => {
    const auth = withDefault(dummyTransport, { appId: undefined });
    expect(() => auth.authorizationUrl({ redirectUrl: "https://x" })).toThrow(
      PortersConfigError,
    );
    expect(() => auth.authorizationUrl({ redirectUrl: "https://x" })).toThrow(
      expect.objectContaining({
        category: "config",
        message: expect.stringContaining("appId is required") as string,
        hint: expect.stringContaining("Set appId") as string,
      }),
    );
  });
});

describe("createAuthApi — exchangeAuthorizationCode (ADR-0034 SD-3)", () => {
  it("exchanges the code and saves tokens so getToken returns them without code_direct", async () => {
    const { transport, calls } = recording(defaultBodies);
    const auth = withDefault(transport);

    await expect(
      auth.exchangeAuthorizationCode("CODE_FROM_REDIRECT"),
    ).resolves.toBeUndefined();
    // The built-in flow reports PORTERS' AccessTokenExpiresIn as an absolute expiry (clock = 1000).
    expect(await auth.getToken()).toEqual({
      token: "BROWSER_A",
      expiresAt: 1000 + ACCESS_EXPIRES_IN,
    });

    const tok = tokenCalls(calls);
    expect(tok).toHaveLength(1);
    expect(tok[0]?.body).toContain("grant_type=oauth_code");
    expect(tok[0]?.body).toContain("code=CODE_FROM_REDIRECT");
    // The configured credentials reach the wire (not `undefined` from an empty lookup).
    expect(tok[0]?.body).toContain("app_id=app");
    expect(tok[0]?.body).toContain("secret=secret");
    // cached -> getToken must not trigger a code_direct acquisition.
    expect(oauthCalls(calls)).toHaveLength(0);
  });

  it("throws PortersAuthError when the token endpoint reports an error", async () => {
    const { transport } = recording(() => ({
      body: "<Authentication><Error>1</Error><Message>bad</Message></Authentication>",
    }));
    const auth = withDefault(transport);
    await expect(auth.exchangeAuthorizationCode("c")).rejects.toBeInstanceOf(
      PortersAuthError,
    );
  });

  it("throws PortersConfigError when the built-in provider has no appSecret", async () => {
    const { transport } = recording(defaultBodies);
    const auth = withDefault(transport, { appSecret: undefined });
    await expect(auth.exchangeAuthorizationCode("c")).rejects.toBeInstanceOf(
      PortersConfigError,
    );
    await expect(auth.exchangeAuthorizationCode("c")).rejects.toMatchObject({
      category: "config",
      message: expect.stringContaining(
        "appId and appSecret are required",
      ) as string,
      hint: expect.stringContaining("appId/appSecret") as string,
    });
  });
});

describe("createAuthApi — clearTokens (ADR-0034 SD-4)", () => {
  it("forgets cached + stored tokens so the next call re-acquires", async () => {
    const { transport, calls } = recording(defaultBodies);
    const auth = withDefault(transport);

    await auth.ensureAuthenticated(); // acquire via code_direct (oauth + token)
    await auth.clearTokens();
    await auth.getToken(); // cache + store cleared -> a second code_direct

    expect(oauthCalls(calls)).toHaveLength(2);
  });
});

// 渡した取得（tokenProvider）でも、必要なものがあれば 6 メソッドとも動く（ADR-0091）。
describe("createAuthApi — with a caller's tokenProvider (ADR-0091)", () => {
  const withProvider = (provider: TokenProvider) =>
    createAuthApi({
      accessPoint: { hostname: "example.test" },
      appId: "app",
      scopes: ["candidate_r"],
      provider,
      manager: createTokenManager({ provider, now: () => 1000 }),
    });
  const issuing = (token: string): TokenProvider => ({
    acquire: () => Promise.resolve({ accessToken: { token } }),
  });

  it("getToken returns the expiry the provider reported (and none when it reported none)", async () => {
    const auth = withProvider({
      acquire: () =>
        Promise.resolve({ accessToken: { token: "E", expiresAt: 999_999 } }),
    });
    expect(await auth.getToken()).toEqual({ token: "E", expiresAt: 999_999 });
    expect(await withProvider(issuing("N")).getToken()).toStrictEqual({
      token: "N",
    });
  });

  it("getToken / ensureAuthenticated go through acquire", async () => {
    const auth = withProvider(issuing("CUSTOM"));
    expect((await auth.getToken()).token).toBe("CUSTOM");
    await expect(auth.ensureAuthenticated()).resolves.toBeUndefined();
  });

  it("exchangeAuthorizationCode uses the provider's exchange and saves the result", async () => {
    const seen: string[] = [];
    let acquired = 0;
    const auth = withProvider({
      acquire: () => {
        acquired += 1;
        return Promise.resolve({ accessToken: { token: "ACQ" } });
      },
      exchange: (code) => {
        seen.push(code);
        return Promise.resolve({ accessToken: { token: "EXCHANGED" } });
      },
    });
    await expect(auth.exchangeAuthorizationCode("C1")).resolves.toBeUndefined();
    expect(seen).toEqual(["C1"]);
    expect((await auth.getToken()).token).toBe("EXCHANGED");
    expect(acquired).toBe(0); // the exchanged tokens are used, not re-obtained
  });

  it("exchangeAuthorizationCode rejects when the provider has no exchange", async () => {
    await expect(
      withProvider(issuing("X")).exchangeAuthorizationCode("c"),
    ).rejects.toMatchObject({
      name: "PortersConfigError",
      category: "config",
      message:
        "exchangeAuthorizationCode needs a tokenProvider with exchange(code)",
      hint: expect.stringContaining("Implement exchange(code)") as string,
    });
  });

  it("exchangeAuthorizationCode rejects (not throws) when exchange throws synchronously", async () => {
    const auth = withProvider({
      acquire: () => Promise.resolve({ accessToken: { token: "A" } }),
      exchange: () => {
        throw new Error("sync");
      },
    });
    let result: Promise<void> | undefined;
    expect(() => {
      result = auth.exchangeAuthorizationCode("c");
    }).not.toThrow();
    await expect(result).rejects.toThrow("sync");
  });

  it("clearTokens forgets the cached token so the next call acquires again", async () => {
    let acquired = 0;
    const auth = withProvider({
      acquire: () => {
        acquired += 1;
        return Promise.resolve({ accessToken: { token: `T${acquired}` } });
      },
    });
    expect((await auth.getToken()).token).toBe("T1");
    await auth.clearTokens();
    expect((await auth.getToken()).token).toBe("T2");
  });

  it("authorizationUrl / revokeUrl work whatever the provider, given appId", () => {
    const auth = withProvider(issuing("X"));
    expect(
      new URL(
        auth.authorizationUrl({ redirectUrl: "https://x" }),
      ).searchParams.get("response_type"),
    ).toBe("code");
    expect(
      new URL(auth.revokeUrl({ redirectUrl: "https://x" })).searchParams.get(
        "response_type",
      ),
    ).toBe("remove");
  });
});

describe("createAuthApi — clock", () => {
  it("defaults the clock to Date.now when `now` is not provided", async () => {
    const { transport, calls } = recording(defaultBodies);
    const provider = createDefaultTokenProvider({
      accessPoint: { hostname: "example.test" },
      appId: "app",
      appSecret: "secret",
      transport,
    });
    const auth = createAuthApi({
      accessPoint: { hostname: "example.test" },
      appId: "app",
      scopes: ["candidate_r"],
      provider,
      manager: createTokenManager({ provider }),
    });
    await auth.exchangeAuthorizationCode("c");
    expect((await auth.getToken()).token).toBe("BROWSER_A");
    // A default clock that returned nothing would stamp the tokens with `NaN` expiry — read as
    // "unknown" now, but the stamp itself must be a real time for the proactive renewal to work.
    expect(oauthCalls(calls)).toHaveLength(0);
  });
});
