import { describe, expect, expectTypeOf, it } from "vitest";

import { PortersConfigError } from "../errors";
import { appendPaging, paginateOnce, type Limit, type Paging } from "./paging";

describe("accessor/paging — appendPaging（count のガード・RV-28）", () => {
  const params = (count?: number, start?: number): string => {
    const p = new URLSearchParams();
    appendPaging(p, count, start);
    return p.toString();
  };

  it("範囲内の count と start をそのまま載せる", () => {
    expect(params(50, 100)).toBe("count=50&start=100");
    expect(params(1)).toBe("count=1"); // 下限
    expect(params(200)).toBe("count=200"); // 上限
  });

  it("省略時は何も載せない（API 既定の 10 に委ねる）", () => {
    expect(params()).toBe("");
    expect(params(undefined, 20)).toBe("start=20");
  });

  it.each([0, -1, 201, 500])("範囲外の count=%s を送信前に弾く", (count) => {
    expect(() => params(count)).toThrow(PortersConfigError);
    expect(() => params(count)).toThrow(
      /count must be an integer between 1 and 200/,
    );
  });

  it("整数でない count を弾く（1.5 は PORTERS が解釈できない）", () => {
    expect(() => params(1.5)).toThrow(PortersConfigError);
  });

  it("弾いたときは config カテゴリと searchAll への hint を添える", () => {
    try {
      params(500);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PortersConfigError);
      const err = e as PortersConfigError;
      expect(err.category).toBe("config");
      expect(err.hint).toMatch(/searchAll/);
    }
  });
});

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

describe("accessor/paging — Limit / Paging（ADR-0099）", () => {
  it("Paging is Limit plus start", () => {
    expectTypeOf<Paging>().toEqualTypeOf<Limit & { start?: number }>();
    expectTypeOf<Limit>().toEqualTypeOf<{ count?: number }>();
  });
});
