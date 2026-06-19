import { describe, expect, it } from "vitest";

import { PortersAuthError } from "../errors/index";
import type { Transport, TransportRequest } from "../http/index";
import { createMemoryTokenStore } from "./memory-store";
import { createDefaultTokenProvider } from "./token-provider";
import type { StoredTokens, TokenStore } from "./types";

const CODE_DIRECT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Authentication><Code>CODE123</Code><Error>0</Error><Message>Success</Message></Authentication>`;

const ACCESS_EXPIRES_IN = 1_800_000;
const REFRESH_EXPIRES_IN = 7_200_000;
const MARGIN = 60_000;

const tokenXml = (access: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<Authentication><AccessToken>${access}</AccessToken><AccessTokenExpiresIn>${ACCESS_EXPIRES_IN}</AccessTokenExpiresIn><RefreshToken>REF1</RefreshToken><RefreshTokenExpiresIn>${REFRESH_EXPIRES_IN}</RefreshTokenExpiresIn><Error>0</Error><Message>Success</Message></Authentication>`;

type MockTransport = { transport: Transport; calls: TransportRequest[] };

const makeTransport = (): MockTransport => {
  const calls: TransportRequest[] = [];
  const transport: Transport = {
    send: (req) => {
      calls.push(req);
      if (req.url.includes("/v1/oauth")) {
        return Promise.resolve({ status: 200, body: CODE_DIRECT_XML });
      }
      const refreshing =
        req.body?.includes("grant_type=refresh_token") ?? false;
      return Promise.resolve({
        status: 200,
        body: tokenXml(refreshing ? "ACCESS2" : "ACCESS1"),
      });
    },
  };
  return { transport, calls };
};

// Transport that returns CODE_DIRECT_XML for the oauth step and a fixed
// (possibly malformed) body for the token exchange.
const oauthThenToken = (tokenBody: string): MockTransport => {
  const calls: TransportRequest[] = [];
  const transport: Transport = {
    send: (req) => {
      calls.push(req);
      return Promise.resolve({
        status: 200,
        body: req.url.includes("/v1/oauth") ? CODE_DIRECT_XML : tokenBody,
      });
    },
  };
  return { transport, calls };
};

const oauthCalls = (calls: TransportRequest[]): TransportRequest[] =>
  calls.filter((c) => c.url.includes("/v1/oauth"));
const tokenCalls = (calls: TransportRequest[]): TransportRequest[] =>
  calls.filter((c) => c.url.includes("/v1/token"));

const opts = (transport: Transport, now: () => number) => ({
  host: "example.test",
  appId: "app",
  appSecret: "secret",
  transport,
  now,
});

describe("createDefaultTokenProvider (ADR-0007 / ADR-0012)", () => {
  it("acquires via code_direct -> token on first call", async () => {
    const { transport, calls } = makeTransport();
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    expect(await auth.getAccessToken()).toBe("ACCESS1");
    expect(calls.map((c) => c.url)).toEqual([
      "https://example.test/v1/oauth?app_id=app&response_type=code_direct",
      "https://example.test/v1/token",
    ]);
  });

  it("sends GET for code_direct and POST form-encoded for the token exchange", async () => {
    const { transport, calls } = makeTransport();
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    await auth.getAccessToken();
    const oauth = oauthCalls(calls)[0];
    const token = tokenCalls(calls)[0];
    expect(oauth?.method).toBe("GET");
    expect(token?.method).toBe("POST");
    expect(token?.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
  });

  it("caches: a second call makes no new requests", async () => {
    const { transport, calls } = makeTransport();
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    await auth.getAccessToken();
    await auth.getAccessToken();
    expect(calls).toHaveLength(2); // only the initial acquire (oauth + token)
  });

  it("single-flights concurrent first calls", async () => {
    const { transport, calls } = makeTransport();
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    const [a, b] = await Promise.all([
      auth.getAccessToken(),
      auth.getAccessToken(),
    ]);
    expect([a, b]).toEqual(["ACCESS1", "ACCESS1"]);
    expect(oauthCalls(calls)).toHaveLength(1);
  });

  it("forceRefresh uses the refresh_token grant", async () => {
    const { transport, calls } = makeTransport();
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    await auth.getAccessToken();
    expect(await auth.getAccessToken({ forceRefresh: true })).toBe("ACCESS2");
    const grants = tokenCalls(calls).map((c) => c.body ?? "");
    expect(grants[0]).toContain("grant_type=oauth_code");
    expect(grants[1]).toContain("grant_type=refresh_token");
  });

  it("proactively refreshes when within the expiry margin", async () => {
    const { transport, calls } = makeTransport();
    let t = 1000;
    const auth = createDefaultTokenProvider({
      host: "example.test",
      appId: "app",
      appSecret: "secret",
      transport,
      now: () => t,
    });
    await auth.getAccessToken(); // access valid until 1000 + ACCESS_EXPIRES_IN
    t = 1000 + ACCESS_EXPIRES_IN - 30_000; // within the 60s margin
    expect(await auth.getAccessToken()).toBe("ACCESS2");
    expect(tokenCalls(calls)).toHaveLength(2);
  });

  it("refreshes exactly at the access-token margin boundary (strict <)", async () => {
    const { transport, calls } = makeTransport();
    let t = 1000;
    const auth = createDefaultTokenProvider({
      host: "example.test",
      appId: "app",
      appSecret: "secret",
      transport,
      now: () => t,
    });
    await auth.getAccessToken();
    // now() === accessTokenExpiresAt - margin: a strict `<` treats this as expired.
    t = 1000 + ACCESS_EXPIRES_IN - MARGIN;
    expect(await auth.getAccessToken()).toBe("ACCESS2");
    expect(tokenCalls(calls)).toHaveLength(2);
  });

  it("re-acquires (code_direct) once the refresh token reaches its margin", async () => {
    const { transport, calls } = makeTransport();
    let t = 1000;
    const auth = createDefaultTokenProvider({
      host: "example.test",
      appId: "app",
      appSecret: "secret",
      transport,
      now: () => t,
    });
    await auth.getAccessToken();
    // Both tokens past their margin: cannot refresh -> must re-run code_direct.
    t = 1000 + REFRESH_EXPIRES_IN - MARGIN;
    await auth.getAccessToken();
    expect(oauthCalls(calls)).toHaveLength(2); // a refresh would not re-hit /v1/oauth
  });

  it("throws PortersAuthError when code_direct returns no code", async () => {
    const noCode: Transport = {
      send: () =>
        Promise.resolve({
          status: 200,
          body: "<Authentication><Error>0</Error></Authentication>",
        }),
    };
    const auth = createDefaultTokenProvider(opts(noCode, () => 1000));
    const err = await auth.getAccessToken().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PortersAuthError);
    expect((err as PortersAuthError).message).toBe(
      "code_direct returned no code",
    );
    expect((err as PortersAuthError).category).toBe("auth");
  });

  it("throws PortersAuthError when the token response lacks tokens", async () => {
    const { transport } = oauthThenToken(
      "<Authentication><Error>0</Error></Authentication>",
    );
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    const err = await auth.getAccessToken().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PortersAuthError);
    expect((err as PortersAuthError).message).toBe(
      "token response missing tokens",
    );
    expect((err as PortersAuthError).category).toBe("auth");
  });

  it("throws when only the access token is missing", async () => {
    const { transport } = oauthThenToken(
      "<Authentication><RefreshToken>R</RefreshToken><Error>0</Error></Authentication>",
    );
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(
      PortersAuthError,
    );
  });

  it("throws when only the refresh token is missing", async () => {
    const { transport } = oauthThenToken(
      "<Authentication><AccessToken>A</AccessToken><Error>0</Error></Authentication>",
    );
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(
      PortersAuthError,
    );
  });

  it("uses the default clock when `now` is not provided", async () => {
    const { transport, calls } = makeTransport();
    const auth = createDefaultTokenProvider({
      host: "example.test",
      appId: "app",
      appSecret: "secret",
      transport,
    });
    expect(await auth.getAccessToken()).toBe("ACCESS1");
    // A real clock keeps the freshly minted token valid, so the 2nd call caches.
    expect(await auth.getAccessToken()).toBe("ACCESS1");
    expect(calls).toHaveLength(2);
  });

  it("treats a missing ExpiresIn as 0", async () => {
    const { transport } = oauthThenToken(
      "<Authentication><AccessToken>A</AccessToken><RefreshToken>R</RefreshToken><Error>0</Error></Authentication>",
    );
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    expect(await auth.getAccessToken()).toBe("A");
  });

  it("loads tokens from the store when the cache is cold (refreshes, no re-acquire)", async () => {
    const store = createMemoryTokenStore();
    const seeded: StoredTokens = {
      accessToken: "STORED_A",
      refreshToken: "STORED_R",
      accessTokenExpiresAt: 0, // already expired
      refreshTokenExpiresAt: 10_000_000, // still valid
    };
    await store.set(seeded);
    const { transport, calls } = makeTransport();
    const auth = createDefaultTokenProvider({
      host: "example.test",
      appId: "app",
      appSecret: "secret",
      transport,
      tokenStore: store,
      now: () => 1_000_000,
    });
    expect(await auth.getAccessToken()).toBe("ACCESS2"); // refresh grant, not acquire
    expect(oauthCalls(calls)).toHaveLength(0); // store hit -> no code_direct
  });

  it("does not reload from the store when the cache is warm", async () => {
    const base = createMemoryTokenStore();
    let getCalls = 0;
    const store: TokenStore = {
      get: () => {
        getCalls += 1;
        return base.get();
      },
      set: (t) => base.set(t),
      clear: () => base.clear(),
    };
    let t = 1000;
    const { transport } = makeTransport();
    const auth = createDefaultTokenProvider({
      host: "example.test",
      appId: "app",
      appSecret: "secret",
      transport,
      tokenStore: store,
      now: () => t,
    });
    await auth.getAccessToken(); // cold: reads the (empty) store once, then acquires
    t = 1000 + ACCESS_EXPIRES_IN - MARGIN; // force a refresh, cache is warm
    await auth.getAccessToken();
    expect(getCalls).toBe(1); // warm cache must not re-read the store
  });
});
