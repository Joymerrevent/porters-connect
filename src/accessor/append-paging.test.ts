import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import { appendPaging } from "./append-paging";

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

// RV-74。start は count と違い、これまで検査していなかった。
describe("accessor/paging — appendPaging（start のガード・RV-74）", () => {
  const params = (start: number): string => {
    const p = new URLSearchParams();
    appendPaging(p, undefined, start);
    return p.toString();
  };

  it("0 は通る（先頭から）", () => {
    expect(params(0)).toBe("start=0");
  });

  it.each([-1, 1.5, Number.NaN])("start=%s を送信前に弾く", (start) => {
    expect(() => params(start)).toThrow(PortersConfigError);
    expect(() => params(start)).toThrow(
      `start must be an integer of 0 or more, got ${start}`,
    );
  });

  it("弾くときは category と直し方を持つ", () => {
    let err: unknown;
    try {
      params(-1);
    } catch (e) {
      err = e;
    }
    expect((err as PortersConfigError).category).toBe("config");
    expect((err as PortersConfigError).hint).toContain("0-based");
  });
});
