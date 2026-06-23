import { describe, expect, it } from "vitest";

import { PortersAuthError, PortersConfigError } from "../errors/index";
import type { Transport, TransportRequest } from "../http/index";
import type { Scope } from "../types/index";
import { createAuthApi } from "./auth-api";
import { createDefaultTokenProvider } from "./token-provider";
import type { TokenProvider } from "./types";

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

// A default-strategy auth API wired to its own provider (controls present). `over`
// keys use presence (`in`) so a test can force a value to `undefined`.
const withDefault = (transport: Transport, over: Over = {}) => {
  const provider = createDefaultTokenProvider({
    host: "example.test",
    appId: over.appId ?? "app",
    appSecret: over.appSecret ?? "secret",
    transport,
    now: () => 1000,
  });
  return createAuthApi({
    host: "example.test",
    appId: "appId" in over ? over.appId : "app",
    appSecret: "appSecret" in over ? over.appSecret : "secret",
    scopes: "scopes" in over ? over.scopes : ["candidate_r"],
    transport,
    provider,
    controls: provider,
    now: () => 1000,
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

  it("throws PortersConfigError when no scope is available", () => {
    const auth = withDefault(dummyTransport, { scopes: undefined });
    expect(() => auth.authorizationUrl({ redirectUrl: "https://x" })).toThrow(
      PortersConfigError,
    );
  });

  it("throws PortersConfigError when appId is missing", () => {
    const auth = withDefault(dummyTransport, { appId: undefined });
    expect(() => auth.authorizationUrl({ redirectUrl: "https://x" })).toThrow(
      PortersConfigError,
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
    expect(await auth.getToken()).toBe("BROWSER_A");

    const tok = tokenCalls(calls);
    expect(tok).toHaveLength(1);
    expect(tok[0]?.body).toContain("grant_type=oauth_code");
    expect(tok[0]?.body).toContain("code=CODE_FROM_REDIRECT");
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

  it("throws PortersConfigError when credentials are missing (default strategy)", async () => {
    const { transport } = recording(defaultBodies);
    const auth = withDefault(transport, { appSecret: undefined });
    await expect(auth.exchangeAuthorizationCode("c")).rejects.toBeInstanceOf(
      PortersConfigError,
    );
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

describe("createAuthApi — delegation & custom strategy (ADR-0034 SD-5/SD-6/SD-7)", () => {
  const customAuth = (): ReturnType<typeof createAuthApi> => {
    const provider: TokenProvider = {
      getAccessToken: () => Promise.resolve("CUSTOM"),
    };
    return createAuthApi({
      host: "example.test",
      appId: "app",
      appSecret: "secret",
      scopes: ["candidate_r"],
      transport: dummyTransport,
      provider, // no controls -> custom strategy
    });
  };

  it("getToken / ensureAuthenticated delegate to the provider (custom strategy works)", async () => {
    const auth = customAuth();
    expect(await auth.getToken()).toBe("CUSTOM");
    await expect(auth.ensureAuthenticated()).resolves.toBeUndefined();
  });

  it("exchangeAuthorizationCode rejects under a custom strategy", async () => {
    await expect(
      customAuth().exchangeAuthorizationCode("c"),
    ).rejects.toBeInstanceOf(PortersConfigError);
  });

  it("clearTokens rejects under a custom strategy", async () => {
    await expect(customAuth().clearTokens()).rejects.toBeInstanceOf(
      PortersConfigError,
    );
  });

  it("authorizationUrl still works under a custom strategy when appId is set", () => {
    const url = new URL(
      customAuth().authorizationUrl({ redirectUrl: "https://x" }),
    );
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("defaults the clock to Date.now when `now` is not provided", async () => {
    const { transport } = recording(defaultBodies);
    const provider = createDefaultTokenProvider({
      host: "example.test",
      appId: "app",
      appSecret: "secret",
      transport,
    });
    const auth = createAuthApi({
      host: "example.test",
      appId: "app",
      appSecret: "secret",
      scopes: ["candidate_r"],
      transport,
      provider,
      controls: provider,
    });
    await auth.exchangeAuthorizationCode("c");
    expect(await auth.getToken()).toBe("BROWSER_A");
  });
});
