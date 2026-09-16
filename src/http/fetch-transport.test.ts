import { describe, expect, it, vi } from "vitest";

import { PortersConfigError, PortersNetworkError } from "../errors/index";
import { createFetchTransport } from "./fetch-transport";

describe("createFetchTransport (ADR-0009)", () => {
  it("returns status + text body from the injected fetch", async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        new Response("<xml/>", { status: 200 }),
      )) as unknown as typeof fetch;
    const transport = createFetchTransport({ fetchImpl });

    const res = await transport.send({ method: "GET", url: "u", headers: {} });
    expect(res.status).toBe(200);
    expect(res.body).toBe("<xml/>");
  });

  it("wraps network failures in PortersNetworkError (network, retryable)", async () => {
    const cause = new Error("ECONNRESET");
    const fetchImpl = (() => Promise.reject(cause)) as unknown as typeof fetch;
    const transport = createFetchTransport({ fetchImpl });

    let err: unknown;
    try {
      await transport.send({ method: "GET", url: "u", headers: {} });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersNetworkError);
    const e = err as PortersNetworkError;
    expect(e.category).toBe("network");
    expect(e.retryable).toBe(true);
    expect(e.message).toBe("transport request failed");
    expect(e.cause).toBe(cause);
  });

  it("uses global fetch with the request's method / headers / body", async () => {
    const spy = vi.fn(() =>
      Promise.resolve(new Response("ok", { status: 200 })),
    );
    vi.stubGlobal("fetch", spy);
    const res = await createFetchTransport().send({
      method: "POST",
      url: "https://h/u",
      headers: { "X-A": "1" },
      body: "B",
    });
    expect(res.body).toBe("ok");
    expect(spy).toHaveBeenCalledWith(
      "https://h/u",
      expect.objectContaining({
        method: "POST",
        headers: { "X-A": "1" },
        body: "B",
      }),
    );
    vi.unstubAllGlobals();
  });
});

// ADR-0077: タイムアウトは公開 API から変えられる（それまでは `Transport` の自前実装しか
// 手が無く、PortersNetworkError への分類まで再実装させていた）。
describe("createFetchTransport — timeoutMs（ADR-0077）", () => {
  it("既定は 30 秒で、渡した値がそのまま signal になる", async () => {
    const seen: (AbortSignal | undefined)[] = [];
    const fetchImpl = ((_url: string, init?: RequestInit) => {
      seen.push(init?.signal ?? undefined);
      return Promise.resolve(new Response("ok", { status: 200 }));
    }) as unknown as typeof fetch;

    await createFetchTransport({ fetchImpl }).send({
      method: "GET",
      url: "u",
      headers: {},
    });
    await createFetchTransport({ fetchImpl, timeoutMs: 1 }).send({
      method: "GET",
      url: "u",
      headers: {},
    });
    // signal が渡っていること自体を固定する（秒数は外からは読めない）。
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBeInstanceOf(AbortSignal);
    expect(seen[1]).toBeInstanceOf(AbortSignal);
  });

  it("応答本文の受信が終わらなければ、その signal で中断する", async () => {
    // 本文を流し続ける応答。ヘッダは即返るので、**本文まで見ている**ことが分かる。
    const fetchImpl = ((_url: string, init?: RequestInit) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const timer = setInterval(
            () => controller.enqueue(new TextEncoder().encode("<Item/>")),
            1,
          );
          init?.signal?.addEventListener("abort", () => {
            clearInterval(timer);
            controller.error(init.signal?.reason);
          });
        },
      });
      return Promise.resolve(new Response(stream, { status: 200 }));
    }) as unknown as typeof fetch;

    let err: unknown;
    try {
      await createFetchTransport({ fetchImpl, timeoutMs: 20 }).send({
        method: "GET",
        url: "u",
        headers: {},
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersNetworkError);
    expect((err as PortersNetworkError).retryable).toBe(true);
  });

  it("0 / 負値 / 小数は構築時に弾く（即中断は「無制限」ではない）", () => {
    for (const timeoutMs of [0, -1, 1.5, Number.NaN]) {
      let err: unknown;
      try {
        createFetchTransport({ timeoutMs });
      } catch (e) {
        err = e;
      }
      expect(err, `timeoutMs=${timeoutMs}`).toBeInstanceOf(PortersConfigError);
      expect((err as PortersConfigError).category).toBe("config");
      // 受け取った値と、どうすればよいかがメッセージに出ること（設定ミスは読んで直せる形で返す）。
      expect((err as PortersConfigError).message).toContain(
        "timeoutMs must be a positive integer",
      );
      expect((err as PortersConfigError).hint).toContain("30000");
    }
  });

  it("省略すれば通る（既定 30 秒）", () => {
    expect(() => createFetchTransport()).not.toThrow();
  });
});
