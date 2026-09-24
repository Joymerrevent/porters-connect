import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors/index";
import { createMemoryTokenStore } from "./memory-store";
import { createTokenManager, readStoredTokens } from "./token-manager";
import type { StoredTokens, TokenProvider, TokenStore } from "./types";

// 取得を渡したときの管理（ADR-0091）。既定の取得との組み合わせは token-provider.test.ts が見る。

const MARGIN = 60_000;

type Counting = TokenProvider & { calls: string[] };

// acquire / refresh の呼ばれ方を記録する提供元。返すトークンは呼ばれた順に番号が付く。
const counting = (
  make: (
    kind: "acquire" | "refresh",
    n: number,
    current?: StoredTokens,
  ) => unknown,
  withRefresh = false,
): Counting => {
  const calls: string[] = [];
  const provider: Counting = {
    calls,
    acquire: () => {
      calls.push("acquire");
      return Promise.resolve(make("acquire", calls.length) as StoredTokens);
    },
  };
  if (withRefresh) {
    provider.refresh = (current) => {
      calls.push("refresh");
      return Promise.resolve(
        make("refresh", calls.length, current) as StoredTokens,
      );
    };
  }
  return provider;
};

describe("createTokenManager — obtaining and caching", () => {
  it("acquires on first use and caches a token with no expiry until forced", async () => {
    const p = counting((_, n) => ({ accessToken: { token: `A${n}` } }));
    const m = createTokenManager({ provider: p, now: () => 1000 });
    expect(await m.getAccessToken()).toBe("A1");
    expect(await m.getAccessToken()).toBe("A1"); // unknown expiry = usable (401 is the backstop)
    expect(await m.getAccessToken({ forceRefresh: true })).toBe("A2");
    expect(p.calls).toEqual(["acquire", "acquire"]);
  });

  it("renews shortly before a known expiry, by acquire when there is no refresh", async () => {
    let t = 0;
    const p = counting((_, n) => ({
      accessToken: { token: `A${n}`, expiresAt: 100_000 },
    }));
    const m = createTokenManager({ provider: p, now: () => t });
    await m.getAccessToken();
    t = 100_000 - MARGIN - 1;
    expect(await m.getAccessToken()).toBe("A1"); // still outside the margin
    t = 100_000 - MARGIN;
    expect(await m.getAccessToken()).toBe("A2"); // inside the margin
  });

  it("uses refresh when the issuer hands out no refresh token", async () => {
    const p = counting(
      (kind, n) => ({ accessToken: { token: `${kind}${n}` } }),
      true,
    );
    const m = createTokenManager({ provider: p, now: () => 0 });
    await m.getAccessToken();
    expect(await m.getAccessToken({ forceRefresh: true })).toBe("refresh2");
    expect(p.calls).toEqual(["acquire", "refresh"]);
  });

  it("passes the current tokens to refresh while the refresh token is usable", async () => {
    let seen: StoredTokens | undefined;
    const p = counting((kind, n, current) => {
      if (current) seen = current;
      return {
        accessToken: { token: `${kind}${n}` },
        refreshToken: { token: "R", expiresAt: 1_000_000 },
      };
    }, true);
    const m = createTokenManager({ provider: p, now: () => 0 });
    await m.getAccessToken();
    await m.getAccessToken({ forceRefresh: true });
    expect(p.calls).toEqual(["acquire", "refresh"]);
    expect(seen?.refreshToken?.token).toBe("R");
  });

  it("treats a refresh token with no expiry as usable", async () => {
    const p = counting(
      (kind, n) => ({
        accessToken: { token: `${kind}${n}` },
        refreshToken: { token: "R" },
      }),
      true,
    );
    const m = createTokenManager({ provider: p, now: () => 0 });
    await m.getAccessToken();
    await m.getAccessToken({ forceRefresh: true });
    expect(p.calls).toEqual(["acquire", "refresh"]);
  });

  it("starts over with acquire once the refresh token is inside its margin", async () => {
    let t = 0;
    const p = counting(
      (kind, n) => ({
        accessToken: { token: `${kind}${n}` },
        refreshToken: { token: "R", expiresAt: 200_000 },
      }),
      true,
    );
    const m = createTokenManager({ provider: p, now: () => t });
    await m.getAccessToken();
    t = 200_000 - MARGIN;
    await m.getAccessToken({ forceRefresh: true });
    expect(p.calls).toEqual(["acquire", "acquire"]);
  });

  it("collapses concurrent renewals into one call", async () => {
    let release: (v: StoredTokens) => void = () => undefined;
    let calls = 0;
    const provider: TokenProvider = {
      acquire: () => {
        calls += 1;
        return new Promise<StoredTokens>((r) => {
          release = r;
        });
      },
    };
    const m = createTokenManager({ provider });
    const all = Promise.all([
      m.getAccessToken(),
      m.getAccessToken(),
      m.getAccessToken(),
    ]);
    await Promise.resolve();
    await Promise.resolve();
    release({ accessToken: { token: "ONE" } });
    expect(await all).toEqual(["ONE", "ONE", "ONE"]);
    expect(calls).toBe(1);
  });

  it("passes a provider failure through without retrying", async () => {
    let calls = 0;
    const m = createTokenManager({
      provider: {
        acquire: () => {
          calls += 1;
          return Promise.reject(new Error("issuer down"));
        },
      },
    });
    await expect(m.getAccessToken()).rejects.toThrow("issuer down");
    expect(calls).toBe(1);
  });
});

describe("createTokenManager — checking what the provider returns", () => {
  it.each([
    ["an empty token", { accessToken: { token: "" } }],
    ["a non-string token", { accessToken: { token: 1 } }],
    ["no access token", { refreshToken: { token: "R" } }],
    ["the pre-0.24 flat shape", { accessToken: "A", accessTokenExpiresAt: 1 }],
    ["nothing", undefined],
  ])("rejects %s from acquire with PortersConfigError", async (_, value) => {
    const m = createTokenManager({
      provider: {
        acquire: () => Promise.resolve(value as unknown as StoredTokens),
      },
    });
    const err = await m.getAccessToken().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PortersConfigError);
    expect(err).toMatchObject({
      category: "config",
      message: "tokenProvider.acquire returned no usable access token",
    });
  });

  it("names refresh when refresh returns something unusable", async () => {
    const m = createTokenManager({
      provider: {
        acquire: () => Promise.resolve({ accessToken: { token: "A" } }),
        refresh: () => Promise.resolve({} as StoredTokens),
      },
    });
    await m.getAccessToken();
    await expect(
      m.getAccessToken({ forceRefresh: true }),
    ).rejects.toMatchObject({
      message: "tokenProvider.refresh returned no usable access token",
    });
  });

  it("names exchange when cache() is handed something unusable", async () => {
    const m = createTokenManager({
      provider: {
        acquire: () => Promise.resolve({ accessToken: { token: "A" } }),
      },
    });
    await expect(m.cache({ accessToken: { token: "" } })).rejects.toMatchObject(
      {
        message: "tokenProvider.exchange returned no usable access token",
      },
    );
  });
});

describe("createTokenManager — tokenStore", () => {
  const provider = (token: string): TokenProvider => ({
    acquire: () => Promise.resolve({ accessToken: { token } }),
  });

  it("saves what a caller's provider obtains, and a new manager reuses it", async () => {
    const store = createMemoryTokenStore();
    await createTokenManager({
      provider: provider("FIRST"),
      tokenStore: store,
    }).getAccessToken();
    expect(await store.get()).toEqual({ accessToken: { token: "FIRST" } });
    const restarted = createTokenManager({
      provider: provider("SECOND"),
      tokenStore: store,
    });
    expect(await restarted.getAccessToken()).toBe("FIRST");
  });

  it("clear() forgets the cache and the store", async () => {
    const store = createMemoryTokenStore();
    let n = 0;
    const m = createTokenManager({
      provider: {
        acquire: () => Promise.resolve({ accessToken: { token: `T${++n}` } }),
      },
      tokenStore: store,
    });
    await m.getAccessToken();
    await m.clear();
    expect(await store.get()).toBeUndefined();
    expect(await m.getAccessToken()).toBe("T2");
  });

  it("cache() saves exchanged tokens to the store", async () => {
    const store: TokenStore & { saved: unknown[] } = {
      saved: [],
      get: () => Promise.resolve(undefined),
      set(t) {
        this.saved.push(t);
        return Promise.resolve();
      },
      clear: () => Promise.resolve(),
    };
    const m = createTokenManager({
      provider: provider("X"),
      tokenStore: store,
    });
    await m.cache({ accessToken: { token: "EX", expiresAt: 5 } });
    expect(store.saved).toEqual([
      { accessToken: { token: "EX", expiresAt: 5 } },
    ]);
  });
});

describe("readStoredTokens", () => {
  it("keeps a finite expiry and drops anything else", () => {
    expect(
      readStoredTokens({ accessToken: { token: "A", expiresAt: 5 } }),
    ).toEqual({
      accessToken: { token: "A", expiresAt: 5 },
    });
    expect(
      readStoredTokens({ accessToken: { token: "A", expiresAt: Number.NaN } }),
    ).toEqual({
      accessToken: { token: "A" },
    });
    expect(
      readStoredTokens({ accessToken: { token: "A", expiresAt: "5" } }),
    ).toEqual({
      accessToken: { token: "A" },
    });
  });

  it("drops an unusable refresh token but keeps the access token", () => {
    expect(
      readStoredTokens({
        accessToken: { token: "A" },
        refreshToken: { token: "" },
      }),
    ).toEqual({ accessToken: { token: "A" } });
    expect(
      readStoredTokens({
        accessToken: { token: "A" },
        refreshToken: { token: "R", expiresAt: 9 },
      }),
    ).toEqual({
      accessToken: { token: "A" },
      refreshToken: { token: "R", expiresAt: 9 },
    });
  });

  it("reads anything else as nothing stored", () => {
    for (const v of [
      undefined,
      null,
      "A",
      {},
      { accessToken: null },
      { accessToken: "A" },
    ]) {
      expect(readStoredTokens(v)).toBeUndefined();
    }
  });
});
