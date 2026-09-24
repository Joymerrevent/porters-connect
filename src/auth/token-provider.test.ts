import { describe, expect, it } from "vitest";

import { PortersAuthError } from "../errors/index";
import type {
  Transport,
  TransportRequest,
  TransportResponse,
} from "../http/index";
import { createMemoryTokenStore } from "./memory-store";
import {
  createDefaultTokenProvider,
  type DefaultTokenProviderOptions,
} from "./token-provider";
import { createTokenManager } from "./token-manager";
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

// 既定の取得は「取得」だけになった（ADR-0091）。キャッシュと更新の判断は token manager にあるので、
// 既存の振る舞いのテストは「既定の取得 ＋ 管理」の組み合わせとして走らせ、動きが変わっていないことを見る。
const managed = (
  o: DefaultTokenProviderOptions & {
    tokenStore?: TokenStore;
    refreshMarginMs?: number;
  },
) =>
  createTokenManager({
    provider: createDefaultTokenProvider(o),
    tokenStore: o.tokenStore,
    refreshMarginMs: o.refreshMarginMs,
    now: o.now,
  });

const opts = (transport: Transport, now: () => number) => ({
  accessPoint: { hostname: "example.test" },
  appId: "app",
  appSecret: "secret",
  transport,
  now,
});

describe("createDefaultTokenProvider (ADR-0007 / ADR-0012)", () => {
  it("acquires via code_direct -> token on first call", async () => {
    const { transport, calls } = makeTransport();
    const auth = managed(opts(transport, () => 1000));
    expect(await auth.getAccessToken()).toBe("ACCESS1");
    expect(calls.map((c) => c.url)).toEqual([
      "https://example.test/v1/oauth?app_id=app&response_type=code_direct",
      "https://example.test/v1/token",
    ]);
  });

  it("sends GET for code_direct and POST form-encoded for the token exchange", async () => {
    const { transport, calls } = makeTransport();
    const auth = managed(opts(transport, () => 1000));
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
    const auth = managed(opts(transport, () => 1000));
    await auth.getAccessToken();
    await auth.getAccessToken();
    expect(calls).toHaveLength(2); // only the initial acquire (oauth + token)
  });

  it("single-flights concurrent first calls", async () => {
    const { transport, calls } = makeTransport();
    const auth = managed(opts(transport, () => 1000));
    const [a, b] = await Promise.all([
      auth.getAccessToken(),
      auth.getAccessToken(),
    ]);
    expect([a, b]).toEqual(["ACCESS1", "ACCESS1"]);
    expect(oauthCalls(calls)).toHaveLength(1);
  });

  it("forceRefresh uses the refresh_token grant", async () => {
    const { transport, calls } = makeTransport();
    const auth = managed(opts(transport, () => 1000));
    await auth.getAccessToken();
    expect(await auth.getAccessToken({ forceRefresh: true })).toBe("ACCESS2");
    const grants = tokenCalls(calls).map((c) => c.body ?? "");
    expect(grants[0]).toContain("grant_type=oauth_code");
    expect(grants[1]).toContain("grant_type=refresh_token");
  });

  it("proactively refreshes when within the expiry margin", async () => {
    const { transport, calls } = makeTransport();
    let t = 1000;
    const auth = managed({
      accessPoint: { hostname: "example.test" },
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
    const auth = managed({
      accessPoint: { hostname: "example.test" },
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
    const auth = managed({
      accessPoint: { hostname: "example.test" },
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
    const auth = managed(opts(noCode, () => 1000));
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
    const auth = managed(opts(transport, () => 1000));
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
    const auth = managed(opts(transport, () => 1000));
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(
      PortersAuthError,
    );
  });

  it("throws when only the refresh token is missing", async () => {
    const { transport } = oauthThenToken(
      "<Authentication><AccessToken>A</AccessToken><Error>0</Error></Authentication>",
    );
    const auth = managed(opts(transport, () => 1000));
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(
      PortersAuthError,
    );
  });

  it("uses the default clock when `now` is not provided", async () => {
    const { transport, calls } = makeTransport();
    const auth = managed({
      accessPoint: { hostname: "example.test" },
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
    const auth = managed(opts(transport, () => 1000));
    expect(await auth.getAccessToken()).toBe("A");
  });

  it("loads tokens from the store when the cache is cold (refreshes, no re-acquire)", async () => {
    const store = createMemoryTokenStore();
    const seeded: StoredTokens = {
      accessToken: { token: "STORED_A", expiresAt: 0 }, // already expired
      refreshToken: { token: "STORED_R", expiresAt: 10_000_000 }, // still valid
    };
    await store.set(seeded);
    const { transport, calls } = makeTransport();
    const auth = managed({
      accessPoint: { hostname: "example.test" },
      appId: "app",
      appSecret: "secret",
      transport,
      tokenStore: store,
      now: () => 1_000_000,
    });
    expect(await auth.getAccessToken()).toBe("ACCESS2"); // refresh grant, not acquire
    expect(oauthCalls(calls)).toHaveLength(0); // store hit -> no code_direct
  });

  it("reuses a stored access token that is still valid, without any request", async () => {
    const store = createMemoryTokenStore();
    await store.set({
      accessToken: { token: "STORED_A", expiresAt: 10_000_000 },
      refreshToken: { token: "STORED_R", expiresAt: 20_000_000 },
    });
    const { transport, calls } = makeTransport();
    const auth = managed({
      ...opts(transport, () => 1_000_000),
      tokenStore: store,
    });
    expect(await auth.getAccessToken()).toBe("STORED_A");
    expect(calls).toHaveLength(0);
  });

  // 0.23.0 までの平たい形（accessToken が文字列）は読めない＝無いものとして code_direct で取り直す。
  it("reads a stored value in the pre-0.24 flat shape as nothing stored, and re-acquires", async () => {
    const store: TokenStore = {
      get: () =>
        Promise.resolve({
          accessToken: "OLD_A",
          refreshToken: "OLD_R",
          accessTokenExpiresAt: 99_999_999,
          refreshTokenExpiresAt: 99_999_999,
        } as unknown as StoredTokens),
      set: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };
    const { transport, calls } = makeTransport();
    const auth = managed({
      ...opts(transport, () => 1000),
      tokenStore: store,
    });
    expect(await auth.getAccessToken()).toBe("ACCESS1");
    expect(oauthCalls(calls)).toHaveLength(1);
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
    const auth = managed({
      accessPoint: { hostname: "example.test" },
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

describe("HTTP status on the authentication endpoints (ADR-0050)", () => {
  // What a load balancer / WAF actually returns in front of `/v1/oauth`: an error status and no
  // envelope. Before ADR-0050 this collapsed into "unparseable authentication response" —
  // `category: "unknown"`, `retryable: false` — at the very front of every request (RV-19).
  const answering = (
    res: TransportResponse,
    match = "/v1/oauth",
  ): MockTransport => {
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        if (req.url.includes(match)) return Promise.resolve(res);
        return Promise.resolve({ status: 200, body: CODE_DIRECT_XML });
      },
    };
    return { transport, calls };
  };

  const provider = (transport: Transport) =>
    managed({
      accessPoint: { hostname: "example.test" },
      appId: "app",
      appSecret: "secret",
      transport,
    });

  it("classifies a gateway 5xx on code_direct", async () => {
    const { transport } = answering({
      status: 503,
      body: "<html>maintenance</html>",
    });

    await expect(provider(transport).getAccessToken()).rejects.toMatchObject({
      name: "PortersNetworkError",
      category: "server",
      retryable: true,
      code: null, // no PORTERS code exists — an intermediary answered
      httpStatus: 503,
    });
  });

  it("classifies a gateway 5xx on the token exchange", async () => {
    const { transport } = answering(
      { status: 502, body: "<html>bad gateway</html>" },
      "/v1/token",
    );

    await expect(provider(transport).getAccessToken()).rejects.toMatchObject({
      name: "PortersNetworkError",
      category: "server",
      retryable: true,
      httpStatus: 502,
    });
  });

  it("keeps the <Error> code when an error status carries an envelope", async () => {
    // Both channels answer; the envelope is the more specific one and wins (ADR-0044 判定順).
    const { transport } = answering({
      status: 400,
      body: `<Authentication><Error>103</Error><Message>Invalid code</Message></Authentication>`,
    });

    await expect(provider(transport).getAccessToken()).rejects.toMatchObject({
      name: "PortersAuthError",
      category: "auth",
      code: 103,
      httpStatus: 400,
    });
  });

  it("leaves an ordinary <Error> response exactly as it was", async () => {
    // The regression that matters: HTTP 200 + `<Error>` is the everyday failure, and ADR-0050
    // must not have touched it.
    const { transport } = answering({
      status: 200,
      body: `<Authentication><Error>401</Error><Message>Refresh Token has expired</Message></Authentication>`,
    });

    await expect(provider(transport).getAccessToken()).rejects.toMatchObject({
      name: "PortersAuthError",
      category: "auth",
      code: 401,
      httpStatus: 200, // stamped, as everywhere else (ADR-0044)
    });
  });
});

// 既定の取得そのもの（取得だけ。管理は token manager）の形（ADR-0091）。
describe("createDefaultTokenProvider — acquire / refresh / exchange", () => {
  it("exchange sends the browser code with the oauth_code grant", async () => {
    const { transport, calls } = makeTransport();
    const p = createDefaultTokenProvider(opts(transport, () => 1000));
    const tokens = await p.exchange("FROM_REDIRECT");
    expect(tokens.accessToken.token).toBe("ACCESS1");
    expect(tokenCalls(calls)[0]?.body).toContain("grant_type=oauth_code");
    expect(tokenCalls(calls)[0]?.body).toContain("code=FROM_REDIRECT");
    expect(oauthCalls(calls)).toHaveLength(0);
  });

  it("refresh without a refresh token starts over with code_direct", async () => {
    const { transport, calls } = makeTransport();
    const p = createDefaultTokenProvider(opts(transport, () => 1000));
    await p.refresh({ accessToken: { token: "A" } });
    expect(oauthCalls(calls)).toHaveLength(1);
  });

  // PORTERS が Refresh Token を拒否したら code_direct からやり直す（ADR-0036）。手元の期限だけで
  // 判断していたときは、期限より前に拒否されると同じ refresh を繰り返して止まっていた。
  const refreshAnswers = (status: number, body: string): MockTransport => {
    const calls: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        calls.push(req);
        if (req.url.includes("/v1/oauth"))
          return Promise.resolve({ status: 200, body: CODE_DIRECT_XML });
        if (req.body?.includes("grant_type=refresh_token"))
          return Promise.resolve({ status, body });
        return Promise.resolve({ status: 200, body: tokenXml("ACCESS1") });
      },
    };
    return { transport, calls };
  };
  const authErrorXml = (code: number): string =>
    `<?xml version="1.0" encoding="UTF-8"?>
<Authentication><Error>${code}</Error><Message>rejected</Message></Authentication>`;
  const withRefresh: StoredTokens = {
    accessToken: { token: "OLD_A" },
    refreshToken: { token: "OLD_R" },
  };

  it.each([
    [401, "期限切れ"],
    [107, "無効（別のプロセスが先に更新した）"],
  ])(
    "refresh rejected with auth %i (%s) starts over with code_direct",
    async (code) => {
      const { transport, calls } = refreshAnswers(200, authErrorXml(code));
      const p = createDefaultTokenProvider(opts(transport, () => 1000));
      const tokens = await p.refresh(withRefresh);
      expect(tokens.accessToken.token).toBe("ACCESS1");
      expect(tokenCalls(calls)[0]?.body).toContain("grant_type=refresh_token");
      expect(oauthCalls(calls)).toHaveLength(1);
    },
  );

  it("other refresh failures are not retried with code_direct", async () => {
    // 資格情報の誤り（105）は code_direct でも直らない。
    const secret = refreshAnswers(200, authErrorXml(105));
    await expect(
      createDefaultTokenProvider(opts(secret.transport, () => 1000)).refresh(
        withRefresh,
      ),
    ).rejects.toMatchObject({ name: "PortersAuthError", code: 105 });
    expect(oauthCalls(secret.calls)).toHaveLength(0);

    // PORTERS の応答でない 401（code: null）は、Refresh Token の拒否と読めない。
    const gateway = refreshAnswers(401, "<html>Unauthorized</html>");
    await expect(
      createDefaultTokenProvider(opts(gateway.transport, () => 1000)).refresh(
        withRefresh,
      ),
    ).rejects.toMatchObject({ name: "PortersAuthError", code: null });
    expect(oauthCalls(gateway.calls)).toHaveLength(0);

    // 接続の失敗は再試行の側に任せる。
    const down = refreshAnswers(503, "<html>down</html>");
    await expect(
      createDefaultTokenProvider(opts(down.transport, () => 1000)).refresh(
        withRefresh,
      ),
    ).rejects.toMatchObject({ name: "PortersNetworkError" });
    expect(oauthCalls(down.calls)).toHaveLength(0);
  });

  it("with the manager, a rejected refresh recovers once and the new tokens are kept", async () => {
    // 保存先の Refresh Token は手元の期限内なので、manager は refresh を選ぶ。PORTERS がそれを拒否しても、
    // 1 回の code_direct で回復し、2 回目の呼び出しは何も送らない。
    const { transport, calls } = refreshAnswers(200, authErrorXml(401));
    const tokenStore = createMemoryTokenStore();
    await tokenStore.set({
      accessToken: { token: "OLD_A", expiresAt: 0 },
      refreshToken: { token: "OLD_R", expiresAt: 10_000_000 },
    });
    const auth = managed({ ...opts(transport, () => 1000), tokenStore });
    expect(await auth.getAccessToken()).toBe("ACCESS1");
    expect(await auth.getAccessToken()).toBe("ACCESS1");
    expect(tokenCalls(calls)).toHaveLength(2); // refresh（拒否）＋ code_direct の交換
    expect(oauthCalls(calls)).toHaveLength(1);
    expect((await tokenStore.get())?.refreshToken?.token).toBe("REF1");
  });

  it("stops before sending anything when appId or appSecret is missing", async () => {
    const { transport, calls } = makeTransport();
    const p = createDefaultTokenProvider({
      accessPoint: { hostname: "example.test" },
      appId: "app",
      transport,
    });
    await expect(p.acquire()).rejects.toMatchObject({
      name: "PortersConfigError",
      category: "config",
      hint: expect.stringContaining("tokenProvider") as string,
    });
    await expect(p.exchange("c")).rejects.toMatchObject({
      name: "PortersConfigError",
    });
    expect(calls).toHaveLength(0);
  });

  it("stamps a real expiry with the default clock when `now` is not given", async () => {
    const { transport } = makeTransport();
    const before = Date.now();
    const p = createDefaultTokenProvider({
      accessPoint: { hostname: "example.test" },
      appId: "app",
      appSecret: "secret",
      transport,
    });
    const tokens = await p.acquire();
    expect(tokens.accessToken.expiresAt).toBeGreaterThanOrEqual(
      before + ACCESS_EXPIRES_IN,
    );
    expect(tokens.refreshToken?.expiresAt).toBeGreaterThanOrEqual(
      before + REFRESH_EXPIRES_IN,
    );
  });
});
