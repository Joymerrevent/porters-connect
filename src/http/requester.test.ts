import { describe, expect, it, vi } from "vitest";

import type { AccessTokenSource } from "./types";
import {
  PortersAuthError,
  PortersConfigError,
  PortersNetworkError,
  PortersResourceError,
} from "../errors/index";
import {
  asUnknownOutcome,
  createRequester,
  recoveryFor,
  type AttemptState,
} from "./requester";
import type { Throttle } from "./throttle";
import type { Transport, TransportRequest } from "./types";

const noThrottle: Throttle = { take: () => Promise.resolve() };
const noBackoff = (): number => 0;

const mockAuth = (calls: { force: boolean }[]): AccessTokenSource => ({
  getAccessToken: (o) => {
    calls.push({ force: o?.forceRefresh ?? false });
    return Promise.resolve("TKN");
  },
});

const base = {
  method: "GET",
  url: "u",
  headers: {},
} satisfies TransportRequest;

const post = {
  method: "POST",
  url: "u",
  headers: {},
} satisfies TransportRequest;

const transientErr = (): PortersResourceError =>
  new PortersResourceError("temp", {
    category: "transient",
    code: 9,
    retryable: true,
  });
const networkErr = (): PortersNetworkError =>
  new PortersNetworkError("timeout", { category: "network", retryable: true });
const authErr = (code: number): PortersResourceError =>
  new PortersResourceError("expired", { category: "auth", code });

describe("createRequester (ADR-0009/0010/0012)", () => {
  it("injects auth + version headers and returns the parsed value", async () => {
    const sent: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        sent.push(req);
        return Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(await r.request(base, (b) => b.toUpperCase())).toBe("OK");
    expect(sent[0]?.headers["X-porters-hrbc-oauth-token"]).toBe("TKN");
    expect(sent[0]?.headers["X-P-ConnectAPI-Version"]).toBe("2");
  });

  it("refreshes and retries once on 401", async () => {
    const calls: { force: boolean }[] = [];
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b === "0") {
        throw new PortersResourceError("expired", {
          category: "auth",
          code: 401,
        });
      }
      return "RESULT";
    };
    const r = createRequester({
      transport,
      auth: mockAuth(calls),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(await r.request(base, parse)).toBe("RESULT");
    expect(calls.some((c) => c.force)).toBe(true);
  });

  it("retries transient errors with bounded backoff", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b !== "2") {
        throw new PortersResourceError("temp", {
          category: "transient",
          code: 9,
          retryable: true,
        });
      }
      return "OK";
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(await r.request(base, parse)).toBe("OK");
    expect(n).toBe(3); // failed twice, then succeeded
  });

  it("does not retry create (non-idempotent write) on network uncertainty", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.reject(
          new PortersNetworkError("timeout", {
            category: "network",
            retryable: true,
          }),
        );
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    const error: unknown = await r
      .request({ method: "POST", url: "u", headers: {} }, (b) => b, {
        write: true,
        idempotent: false,
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PortersNetworkError);
    expect(error).toMatchObject({ retryable: false });
    expect((error as PortersNetworkError).hint).toMatch(
      /may have been applied/,
    );
    expect(n).toBe(1); // sent once, not retried
  });

  // ADR-0103: a sent create answered with Code 302 is not resent either.
  it("does not resend a create answered with Code 302", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.resolve({ status: 200, body: "302" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });
    // 応答の `<Code>` を読んで投げるのは parse の役目（parseWriteResult と同じ形のエラー）。
    const parse = (): never => {
      throw new PortersResourceError("transaction", {
        category: "transient",
        code: 302,
        retryable: true,
      });
    };
    await expect(
      r.request({ method: "POST", url: "u", headers: {} }, parse, {
        write: true,
        idempotent: false,
      }),
    ).rejects.toMatchObject({
      name: "PortersResourceError",
      code: 302,
      retryable: false,
    });
    expect(n).toBe(1);
  });

  // ADR-0063: the guard asks "may this write have applied?", not "is this a network error?".
  // A token fetch that fails never put the request on the wire, so a replay cannot duplicate.
  it("retries create after a token fetch failure (the request never left)", async () => {
    let tokens = 0;
    let sends = 0;
    const auth: AccessTokenSource = {
      getAccessToken: () => {
        tokens += 1;
        return tokens === 1
          ? Promise.reject(networkErr())
          : Promise.resolve("TKN");
      },
    };
    const transport: Transport = {
      send: () => {
        sends += 1;
        return Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth,
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(
      await r.request(post, (b) => b, { write: true, idempotent: false }),
    ).toBe("ok");
    expect(tokens).toBe(2);
    expect(sends).toBe(1); // 送信は 1 回だけ＝二重登録の余地は無い
  });

  // 429 は「処理される前に拒否された」ので、これも適用されていないと分かっている失敗
  // （VERIFY(live) LV-9: 実 PORTERS は切断する想定で、429 は中間装置由来）。
  it("retries create after a 429 (refused before it was processed)", async () => {
    let sends = 0;
    const transport: Transport = {
      send: () => {
        sends += 1;
        return Promise.resolve(
          sends === 1 ? { status: 429, body: "" } : { status: 200, body: "ok" },
        );
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(
      await r.request(post, (b) => b, { write: true, idempotent: false }),
    ).toBe("ok");
    expect(sends).toBe(2); // 429 -> バックオフして再送 -> 成功
  });

  it("gives up after maxRetries on persistent transient errors", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (): string => {
      throw new PortersResourceError("temp", {
        category: "transient",
        code: 9,
        retryable: true,
      });
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
      maxRetries: 2,
    });

    await expect(r.request(base, parse)).rejects.toBeInstanceOf(
      PortersResourceError,
    );
    expect(n).toBe(3); // initial + 2 retries
  });

  it("rethrows a non-PortersError thrown by parse", async () => {
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: "x" }),
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    await expect(
      r.request(base, () => {
        throw new TypeError("boom");
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it("adds the write Content-Type header but not on reads", async () => {
    const sent: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        sent.push(req);
        return Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    await r.request(post, (b) => b, { write: true });
    await r.request(base, (b) => b); // read

    expect(sent[0]?.headers["Content-Type"]).toBe(
      "application/xml; charset=UTF-8",
    );
    expect(sent[1]?.headers["Content-Type"]).toBeUndefined(); // write defaults to false
  });

  it("forces a refresh only for the 401 retry — not initially, not on later retries", async () => {
    const calls: { force: boolean }[] = [];
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b === "0") throw authErr(401);
      if (b === "1") throw transientErr();
      return "RESULT";
    };
    const r = createRequester({
      transport,
      auth: mockAuth(calls),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(await r.request(base, parse)).toBe("RESULT");
    // initial=false, 401-retry=true, transient-retry back to false
    expect(calls.map((c) => c.force)).toEqual([false, true, false]);
  });

  // RV-75。取り直しを頼むときに、断られたトークンを渡す（ほかのリクエストが取り直していれば、それを使うため）。
  it("passes the refused token along when it asks for a refresh", async () => {
    const asked: (
      { forceRefresh?: boolean; failedToken?: string } | undefined
    )[] = [];
    let n = 0;
    const auth: AccessTokenSource = {
      getAccessToken: (o) => {
        asked.push(o);
        n += 1;
        return Promise.resolve(`T${n}`);
      },
    };
    let sends = 0;
    const transport: Transport = {
      send: () => {
        sends += 1;
        return sends === 1
          ? Promise.reject(authErr(401))
          : Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth,
      throttle: noThrottle,
      backoff: noBackoff,
    });
    await r.request(base, (b) => b);
    expect(asked).toEqual([
      undefined,
      { forceRefresh: true, failedToken: "T1" },
    ]);
  });

  it("refreshes on 402 as well as 401", async () => {
    const calls: { force: boolean }[] = [];
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b === "0") throw authErr(402);
      return "RESULT";
    };
    const r = createRequester({
      transport,
      auth: mockAuth(calls),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(await r.request(base, parse)).toBe("RESULT");
    expect(calls.some((c) => c.force)).toBe(true);
  });

  it("refreshes at most once for repeated 401s (no infinite refresh)", async () => {
    const calls: { force: boolean }[] = [];
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.resolve({ status: 200, body: "x" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth(calls),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    await expect(
      r.request(base, () => {
        throw authErr(401);
      }),
    ).rejects.toBeInstanceOf(PortersResourceError);
    expect(n).toBe(2); // initial + one refresh retry, then give up
    expect(calls.filter((c) => c.force).length).toBe(1);
  });

  it("does not force another refresh when the token fetch fails with an Authentication API 401 / 402", async () => {
    // 認証 API の 401 は「Refresh Token の期限切れ」、402 は「アクセス許可が無い」で、リソースの 401 / 402
    // （Access Token の期限切れ）とは番号が同じだけの別物。取り直しを強いても、いま失敗した取得を繰り返すだけ。
    for (const code of [401, 402]) {
      const calls: { force: boolean }[] = [];
      const sent: TransportRequest[] = [];
      const r = createRequester({
        transport: {
          send: (req) => {
            sent.push(req);
            return Promise.resolve({ status: 200, body: "x" });
          },
        },
        auth: {
          getAccessToken: (o) => {
            calls.push({ force: o?.forceRefresh ?? false });
            return Promise.reject(
              new PortersAuthError("rejected", { category: "auth", code }),
            );
          },
        },
        throttle: noThrottle,
        backoff: noBackoff,
      });

      await expect(r.request(base, (b) => b)).rejects.toMatchObject({
        name: "PortersAuthError",
        code,
      });
      expect(calls).toEqual([{ force: false }]);
      expect(sent).toHaveLength(0);
    }
  });

  it("retries an idempotent GET on a network error", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.reject(networkErr());
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
      maxRetries: 2,
    });

    await expect(r.request(base, (b) => b)).rejects.toBeInstanceOf(
      PortersNetworkError,
    );
    expect(n).toBe(3); // GET is idempotent -> initial + 2 retries
  });

  it("does not retry a default create (no idempotent flag) on a network error", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.reject(networkErr());
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    await expect(
      r.request(post, (b) => b, { write: true }),
    ).rejects.toBeInstanceOf(PortersNetworkError);
    expect(n).toBe(1); // write defaults to non-idempotent
  });

  it("retries an explicitly idempotent write on a network error", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return n < 2
          ? Promise.reject(networkErr())
          : Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    expect(
      await r.request(post, (b) => b, { write: true, idempotent: true }),
    ).toBe("ok");
    expect(n).toBe(2); // idempotent -> retried once, then succeeded
  });

  it("retries a create on a transient (non-network) error", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b !== "1") throw transientErr();
      return "OK";
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    // the network-uncertainty guard is network-only; transient writes still retry
    expect(
      await r.request(post, parse, { write: true, idempotent: false }),
    ).toBe("OK");
    expect(n).toBe(2);
  });

  it("rethrows a non-PortersError immediately, even if it looks retryable", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.resolve({ status: 200, body: "x" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });
    const weird = Object.assign(new Error("weird"), {
      retryable: true,
      code: 9,
    });

    await expect(
      r.request(base, () => {
        throw weird;
      }),
    ).rejects.toBe(weird);
    expect(n).toBe(1); // not a PortersError -> never retried
  });

  it("rejects an oversized body before reaching the transport", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    let err: unknown;
    try {
      await r.request(
        { method: "POST", url: "u", headers: {}, body: "x".repeat(15001) },
        (b) => b,
        { write: true },
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).category).toBe("config");
    // total = url ("u", 1) + body (15001) = 15002 > 15000
    expect((err as PortersConfigError).message).toContain("15002");
    expect((err as PortersConfigError).message).toContain("15000");
    expect((err as PortersConfigError).hint).toContain("batches");
    expect(n).toBe(0); // never sent — guarded before transport
  });

  it("rejects an oversized read URL (no body) before the transport — RV-5", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    let err: unknown;
    try {
      // A GET has no body; the length lives in the URL (field / condition query string).
      await r.request(
        { method: "GET", url: "u".repeat(15001), headers: {} },
        (b) => b,
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).message).toContain("15001");
    expect((err as PortersConfigError).hint).toContain("field/condition");
    expect(n).toBe(0); // never sent — guarded before transport
  });

  it("allows a request exactly at the limit through to the transport", async () => {
    const sent: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        sent.push(req);
        return Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    // total = url ("u", 1) + body (14999) = 15000; == limit is allowed, only > is blocked
    const body = "x".repeat(14999);
    expect(
      await r.request(
        { method: "POST", url: "u", headers: {}, body },
        (b) => b,
        {
          write: true,
        },
      ),
    ).toBe("ok");
    expect(sent).toHaveLength(1);
  });

  it("skips the size guard when unboundedBody is set (file uploads)", async () => {
    const sent: TransportRequest[] = [];
    const transport: Transport = {
      send: (req) => {
        sent.push(req);
        return Promise.resolve({ status: 200, body: "ok" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    // a body well over the 15000-char limit goes through when unboundedBody is true
    const body = "x".repeat(20000);
    expect(
      await r.request(
        { method: "POST", url: "u", headers: {}, body },
        (b) => b,
        {
          write: true,
          unboundedBody: true,
        },
      ),
    ).toBe("ok");
    expect(sent).toHaveLength(1);
  });

  // The classification rules themselves (which channel wins, when a status overrides a parsed
  // body, what carries `httpStatus`) are specified next to the code in `read-response.test.ts`.
  // What belongs here is what the *pipeline* does with the result: retry, and the guard that
  // keeps a non-idempotent write from being replayed.
  it("retries a retryable HTTP status and gives up after maxRetries", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.resolve({ status: 503, body: "" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
      maxRetries: 2,
    });

    await expect(r.request(base, (b) => b)).rejects.toMatchObject({
      category: "server",
      httpStatus: 503,
    });
    expect(n).toBe(3); // initial + 2 retries
  });

  it("does not replay a create after a 5xx (it may already have applied)", async () => {
    let n = 0;
    const transport: Transport = {
      send: () => {
        n += 1;
        return Promise.resolve({ status: 500, body: "" });
      },
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: noBackoff,
    });

    await expect(
      r.request(post, (b) => b, { write: true, idempotent: false }),
    ).rejects.toBeInstanceOf(PortersNetworkError);
    expect(n).toBe(1); // the idempotency guard covers HTTP-level uncertainty too
  });

  it("waits backoff(attempt-1) between transient retries", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const backoffArgs: number[] = [];
    let n = 0;
    const transport: Transport = {
      send: () => Promise.resolve({ status: 200, body: String(n++) }),
    };
    const parse = (b: string): string => {
      if (b !== "2") throw transientErr();
      return "OK";
    };
    const r = createRequester({
      transport,
      auth: mockAuth([]),
      throttle: noThrottle,
      backoff: (a) => {
        backoffArgs.push(a);
        return 7;
      },
    });

    const p = r.request(base, parse);
    await vi.runAllTimersAsync();
    expect(await p).toBe("OK");
    expect(backoffArgs[0]).toBe(0); // first retry: attempt(1) - 1 = 0
    expect(setTimeoutSpy.mock.calls.map((c) => Number(c[1]))).toContain(7);

    setTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe("recoveryFor", () => {
  // 1 回目の試行で、送信まで届いた読み込み。各テストは、ここから 1 つだけ変える。
  const state = (over: Partial<AttemptState> = {}): AttemptState => ({
    sent: true,
    authRetried: false,
    write: false,
    idempotent: true,
    attempt: 0,
    maxRetries: 3,
    ...over,
  });

  it("refreshes on the first Resource API 401 / 402, and only the first", () => {
    expect(recoveryFor(authErr(401), state())).toBe("refresh");
    expect(recoveryFor(authErr(402), state())).toBe("refresh");
    expect(recoveryFor(authErr(401), state({ authRetried: true }))).toBe(
      "throw",
    );
  });

  it("backs off on a retryable error while retries remain", () => {
    expect(recoveryFor(transientErr(), state())).toBe("backoff");
    expect(recoveryFor(networkErr(), state({ attempt: 2 }))).toBe("backoff");
    expect(recoveryFor(transientErr(), state({ attempt: 3 }))).toBe("throw");
  });

  it("reports an unknown outcome for a network error on a sent create", () => {
    const create = state({ write: true, idempotent: false });
    expect(recoveryFor(networkErr(), create)).toBe("unknownOutcome");
    // 再試行しない通信の失敗（3xx を unknown と分類した場合など）も、適用されたかは分からない。
    const redirected = new PortersNetworkError("302 Found", {
      category: "unknown",
      httpStatus: 302,
    });
    expect(recoveryFor(redirected, create)).toBe("unknownOutcome");
    // 送信前の失敗と 429 は、書き込まれていないと分かっているので送り直してよい。
    expect(recoveryFor(networkErr(), { ...create, sent: false })).toBe(
      "backoff",
    );
    const tooMany = new PortersNetworkError("429", {
      category: "rateLimit",
      retryable: true,
    });
    expect(recoveryFor(tooMany, create)).toBe("backoff");
  });

  // ADR-0103: 送信済みの create で再送してよいのは、未処理が確定する Code 9 だけ。
  it("resends a sent create only on Code 9, and reports 302 as an unknown outcome", () => {
    const create = state({ write: true, idempotent: false });
    const code = (c: number): PortersResourceError =>
      new PortersResourceError("temp", {
        category: "transient",
        code: c,
        retryable: true,
      });
    expect(recoveryFor(code(9), create)).toBe("backoff");
    expect(recoveryFor(code(302), create)).toBe("unknownOutcome");
    // 冪等な書き込み（update）と読み込みは、302 でも送り直す。
    expect(recoveryFor(code(302), state({ write: true }))).toBe("backoff");
    expect(recoveryFor(code(302), state())).toBe("backoff");
    // PORTERS が状態を返した、再試行しない失敗は、そのまま投げる。
    const invalid = new PortersResourceError("bad value", {
      category: "validation",
      code: 103,
    });
    expect(recoveryFor(invalid, create)).toBe("throw");
  });

  it("throws an error that is not retryable", () => {
    const denied = new PortersAuthError("denied", { category: "auth" });
    expect(recoveryFor(denied, state())).toBe("throw");
  });
});

describe("asUnknownOutcome", () => {
  it("keeps the class and details, but is not retryable and carries the original as cause", () => {
    const original = new PortersNetworkError("timeout", {
      category: "network",
      retryable: true,
      httpStatus: 504,
      context: { resource: "Candidate" },
    });
    const e = asUnknownOutcome(original);
    expect(e).toBeInstanceOf(PortersNetworkError);
    expect(e).toMatchObject({
      message: "timeout",
      category: "network",
      retryable: false,
      httpStatus: 504,
      context: { resource: "Candidate" },
      cause: original,
    });
    expect(e.hint).toMatch(/may have been applied/);

    const busy = new PortersResourceError("transaction", {
      category: "transient",
      code: 302,
      retryable: true,
    });
    const r = asUnknownOutcome(busy);
    expect(r).toBeInstanceOf(PortersResourceError);
    expect(r).toMatchObject({ code: 302, retryable: false, cause: busy });
  });
});
