import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
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
      { items: [1, 2], total: 3 },
      { items: [3], total: 3 },
    ];
    const walk = paginateOnce<number>(() => {
      prepared += 1;
      return () => Promise.resolve(pages.shift() ?? { items: [], total: 3 });
    });
    expect(prepared).toBe(0); // 呼んだだけでは走らない（ジェネレータ）
    expect(await drain(walk)).toEqual([1, 2, 3]);
    expect(prepared).toBe(1); // 2 ページ取っても直列化は 1 回
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
