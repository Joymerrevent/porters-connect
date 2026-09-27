import { describe, expect, it } from "vitest";

import { PortersConfigError, PortersResourceError } from "../errors";
import { paginateOnce } from "./paginate";

describe("accessor/paging — paginateOnce", () => {
  const drain = async <T>(it: AsyncIterable<T>): Promise<T[]> => {
    const out: T[] = [];
    for await (const x of it) out.push(x);
    return out;
  };

  it("prepares the fetcher once, and only when the first page is asked for (RV-32)", async () => {
    let prepared = 0;
    const pages = [
      { items: [1, 2], total: 3, start: 0 },
      { items: [3], total: 3, start: 2 },
    ];
    const walk = paginateOnce<number>(() => {
      prepared += 1;
      return () =>
        Promise.resolve(pages.shift() ?? { items: [], total: 3, start: 3 });
    });
    expect(prepared).toBe(0); // 呼んだだけでは走らない（ジェネレータ）
    expect(await drain(walk)).toEqual([1, 2, 3]);
    expect(prepared).toBe(1); // 2 ページ取っても直列化は 1 回
  });

  // RV-71。start を無視して毎回先頭を返す応答では、同じレコードを繰り返し返していた。
  it("stops when a page does not start where it was asked to", async () => {
    const walk = paginateOnce<number>(
      () => (_count, start) =>
        Promise.resolve({ items: [start + 1, start + 2], total: 4, start: 0 }),
    );
    const out: number[] = [];
    let err: unknown;
    try {
      for await (const x of walk) out.push(x);
    } catch (e) {
      err = e;
    }
    expect(out).toEqual([1, 2]); // 1 ページ目は正しいので渡してから止まる
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).message).toBe(
      "searchAll asked for records from 2, but the response starts at 0",
    );
    expect((err as PortersResourceError).category).toBe("unknown");
    expect((err as PortersResourceError).hint).toContain("stopped");
  });

  it("surfaces a prepare failure as a rejected iteration, not a synchronous throw (ADR-0046)", async () => {
    const walk = paginateOnce<number>(() => {
      throw new PortersConfigError("bad query", { category: "config" });
    });
    await expect(drain(walk)).rejects.toBeInstanceOf(PortersConfigError);
  });
});

// カタログ外の値を読む逃げ道（ADR-0074 D2）。3 つの状態（無い / スカラでない / 生の値）を
// 別物として返すことが決定の中身なので、潰れていないことをここで固定する。
