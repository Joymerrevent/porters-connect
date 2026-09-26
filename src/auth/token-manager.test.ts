import { describe, expect, it, vi } from "vitest";

import { PortersConfigError } from "../errors/index";
import { createMemoryTokenStore } from "./memory-token-store";
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
    // acquire が呼ばれるまで待ってから返す（待つマイクロタスクの数に頼らない）。
    await vi.waitFor(() => {
      expect(calls).toBe(1);
    });
    release({ accessToken: { token: "ONE" } });
    expect(await all).toEqual(["ONE", "ONE", "ONE"]);
    expect(calls).toBe(1);
  });

  // RV-75。同時に 401 で断られたリクエストは、同じ古いトークンを渡してくる。取り直しは 1 回にまとめる。
  it("renews once for requests refused together with the same token", async () => {
    const provider = counting(
      (_kind, n) => ({ accessToken: { token: `T${n}` } }),
      true,
    );
    const m = createTokenManager({ provider });
    expect(await m.getAccessToken()).toBe("T1");
    const again = await Promise.all(
      [1, 2, 3].map(() =>
        m.getAccessToken({ forceRefresh: true, failedToken: "T1" }),
      ),
    );
    expect(again).toEqual(["T2", "T2", "T2"]);
    expect(provider.calls).toEqual(["acquire", "refresh"]);
  });

  it("reuses a token another request already renewed, instead of renewing again", async () => {
    const provider = counting(
      (_kind, n) => ({ accessToken: { token: `T${n}` } }),
      true,
    );
    const m = createTokenManager({ provider });
    await m.getAccessToken(); // T1
    await m.getAccessToken({ forceRefresh: true, failedToken: "T1" }); // T2
    // T1 で断られたリクエストが遅れて届いた: すでに T2 があるので、取り直さない。
    expect(
      await m.getAccessToken({ forceRefresh: true, failedToken: "T1" }),
    ).toBe("T2");
    // T2 そのものが断られたら、取り直す。
    expect(
      await m.getAccessToken({ forceRefresh: true, failedToken: "T2" }),
    ).toBe("T3");
    expect(provider.calls).toEqual(["acquire", "refresh", "refresh"]);
  });

  it("obtains a token when a refused token comes back after the cache was cleared", async () => {
    const provider = counting((_kind, n) => ({
      accessToken: { token: `T${n}` },
    }));
    const m = createTokenManager({ provider });
    await m.getAccessToken(); // T1
    await m.clear();
    expect(
      await m.getAccessToken({ forceRefresh: true, failedToken: "T1" }),
    ).toBe("T2");
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

// getToken() が返す値（ADR-0093）。リクエストに使うのと同じトークンを、期限つきで写しとして返す。
describe("createTokenManager — getIssuedToken", () => {
  it("returns the usable Access Token with its expiry, renewing first when it is due", async () => {
    let t = 0;
    const p = counting((_, n) => ({
      accessToken: { token: `A${n}`, expiresAt: 100_000 * n },
    }));
    const m = createTokenManager({ provider: p, now: () => t });
    expect(await m.getIssuedToken()).toEqual({
      token: "A1",
      expiresAt: 100_000,
    });
    t = 100_000 - MARGIN; // inside the margin: renewed before it is handed out
    expect(await m.getIssuedToken()).toEqual({
      token: "A2",
      expiresAt: 200_000,
    });
    expect(await m.getAccessToken()).toBe("A2"); // the same token a request would use
  });

  it("leaves expiresAt out when the provider reported none", async () => {
    const m = createTokenManager({
      provider: counting(() => ({ accessToken: { token: "A" } })),
      now: () => 0,
    });
    expect(await m.getIssuedToken()).toStrictEqual({ token: "A" });
  });

  it("hands out a copy: changing it does not change the cached token", async () => {
    const m = createTokenManager({
      provider: counting(() => ({
        accessToken: { token: "A", expiresAt: 100_000 },
      })),
      now: () => 0,
    });
    const issued = await m.getIssuedToken();
    issued.token = "tampered";
    issued.expiresAt = 0;
    expect(await m.getIssuedToken()).toEqual({
      token: "A",
      expiresAt: 100_000,
    });
    expect(await m.getAccessToken()).toBe("A");
  });

  it("never includes the Refresh Token", async () => {
    const m = createTokenManager({
      provider: counting(() => ({
        accessToken: { token: "A" },
        refreshToken: { token: "R" },
      })),
      now: () => 0,
    });
    expect(Object.keys(await m.getIssuedToken())).toEqual(["token"]);
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
      hint: "Return { accessToken: { token, expiresAt? } } with a non-empty token string (expiresAt in epoch ms, optional).",
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

  it("reads the store once, even when acquiring keeps failing", async () => {
    let gets = 0;
    const store: TokenStore = {
      get: () => {
        gets += 1;
        return Promise.resolve(undefined);
      },
      set: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };
    const m = createTokenManager({
      provider: { acquire: () => Promise.reject(new Error("down")) },
      tokenStore: store,
    });
    await expect(m.getAccessToken()).rejects.toThrow("down");
    await expect(m.getAccessToken()).rejects.toThrow("down");
    expect(gets).toBe(1);
  });

  // RV-75。保存先の読み込みが遅くても、その間に来た呼び出しは同じ読み込みを待つ（取得に進まない）。
  it("makes calls that arrive during a slow store read wait for it, not acquire", async () => {
    let finish: (v: StoredTokens) => void = () => undefined;
    let gets = 0;
    const store: TokenStore = {
      get: () => {
        gets += 1;
        return new Promise((r) => {
          finish = r;
        });
      },
      set: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };
    let acquires = 0;
    const m = createTokenManager({
      provider: {
        acquire: () => {
          acquires += 1;
          return Promise.resolve({ accessToken: { token: "FRESH" } });
        },
      },
      tokenStore: store,
    });
    const all = Promise.all([1, 2, 3].map(() => m.getAccessToken()));
    await vi.waitFor(() => {
      expect(gets).toBe(1);
    });
    finish({ accessToken: { token: "STORED" } });
    expect(await all).toEqual(["STORED", "STORED", "STORED"]);
    expect(acquires).toBe(0);
    expect(gets).toBe(1);
  });

  it("reads the store again after a failed read, instead of skipping it for good", async () => {
    let gets = 0;
    const store: TokenStore = {
      get: () => {
        gets += 1;
        return gets === 1
          ? Promise.reject(new Error("store down"))
          : Promise.resolve({ accessToken: { token: "STORED" } });
      },
      set: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };
    const m = createTokenManager({
      provider: {
        acquire: () => Promise.resolve({ accessToken: { token: "FRESH" } }),
      },
      tokenStore: store,
    });
    await expect(m.getAccessToken()).rejects.toThrow("store down");
    expect(await m.getAccessToken()).toBe("STORED");
    expect(gets).toBe(2);
  });

  // 保存先を読んでいる間に手元が入れ替わったら、読んだ古い値で上書きしない（RV-121・RV-91）。
  const slowStore = (): TokenStore & {
    finish: (v: StoredTokens) => void;
    sets: unknown[];
    cleared: number;
  } => {
    const s = {
      finish: (_v: StoredTokens): void => undefined,
      sets: [] as unknown[],
      cleared: 0,
      get: (): Promise<StoredTokens | undefined> =>
        new Promise((r) => {
          s.finish = r;
        }),
      set: (v: StoredTokens): Promise<void> => {
        s.sets.push(v);
        return Promise.resolve();
      },
      clear: (): Promise<void> => {
        s.cleared += 1;
        return Promise.resolve();
      },
    };
    return s;
  };

  it("keeps a token cached while the store was being read", async () => {
    const store = slowStore();
    const m = createTokenManager({
      provider: provider("ACQ"),
      tokenStore: store,
    });
    const first = m.getAccessToken();
    await m.cache({ accessToken: { token: "NEW" } });
    store.finish({ accessToken: { token: "OLD" } });
    expect(await first).toBe("NEW");
    expect(await m.getAccessToken()).toBe("NEW");
  });

  it("does not bring back a token read from the store after clear()", async () => {
    const store = slowStore();
    const m = createTokenManager({
      provider: provider("ACQ"),
      tokenStore: store,
    });
    const first = m.getAccessToken();
    await m.clear();
    store.finish({ accessToken: { token: "OLD" } });
    expect(await first).toBe("ACQ");
  });

  // 取り直しの途中で clear() が呼ばれたら、取れたトークンはそのリクエストにだけ使い、戻さない（RV-91）。
  it("does not save a token renewed while clear() was called", async () => {
    const saved: unknown[] = [];
    let release: (v: StoredTokens) => void = () => undefined;
    let n = 0;
    const m = createTokenManager({
      provider: {
        acquire: () => {
          n += 1;
          return n === 1
            ? new Promise((r) => {
                release = r;
              })
            : Promise.resolve({ accessToken: { token: `T${n}` } });
        },
      },
      tokenStore: {
        get: () => Promise.resolve(undefined),
        set: (v) => {
          saved.push(v);
          return Promise.resolve();
        },
        clear: () => Promise.resolve(),
      },
    });
    const first = m.getAccessToken();
    await vi.waitFor(() => {
      expect(n).toBe(1);
    });
    await m.clear();
    release({ accessToken: { token: "T1" } });
    expect(await first).toBe("T1");
    expect(saved).toEqual([]);
    expect(await m.getAccessToken()).toBe("T2");
    expect(saved).toEqual([{ accessToken: { token: "T2" } }]);
  });

  it("keeps a token cached while a renewal was running", async () => {
    let release: (v: StoredTokens) => void = () => undefined;
    let n = 0;
    const m = createTokenManager({
      provider: {
        acquire: () => {
          n += 1;
          return new Promise((r) => {
            release = r;
          });
        },
      },
    });
    const first = m.getAccessToken();
    await vi.waitFor(() => {
      expect(n).toBe(1);
    });
    await m.cache({ accessToken: { token: "EXCHANGED" } });
    release({ accessToken: { token: "RENEWED" } });
    expect(await first).toBe("RENEWED");
    expect(await m.getAccessToken()).toBe("EXCHANGED");
  });

  it("keeps exchanged tokens even when the store would return something else", async () => {
    const stale: TokenStore = {
      get: () => Promise.resolve({ accessToken: { token: "STALE" } }),
      set: () => Promise.resolve(), // a store that did not keep what it was given
      clear: () => Promise.resolve(),
    };
    const m = createTokenManager({
      provider: provider("ACQ"),
      tokenStore: stale,
    });
    await m.cache({ accessToken: { token: "EXCHANGED" } });
    expect(await m.getAccessToken()).toBe("EXCHANGED");
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
      // toStrictEqual: no `refreshToken: undefined` key is left behind.
    ).toStrictEqual({ accessToken: { token: "A" } });
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
