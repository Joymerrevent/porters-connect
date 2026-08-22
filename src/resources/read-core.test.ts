import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";

import type { FieldValue } from "../xml/decode";
import { appendPaging, decoderFor, type FieldCatalog } from "./read-core";

// runRead / paginate are exercised through resource.test.ts and the master tests; here we pin
// the shared decoder directly, including bareAlias on both prefixed and prefix-less keys.
const FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
  // カタログにあるが PORTERS が Data Type を与えていない項目（ADR-0056）。
  P_Deleted: null,
} as const satisfies FieldCatalog;

describe("read-core — decoderFor", () => {
  it("decodes catalogued fields by both prefixed and prefix-less alias", () => {
    const rec = decoderFor(FIELDS)({ "X.P_Id": "7", P_Name: "hi" }) as Record<
      string,
      FieldValue | undefined
    >;
    expect(rec.P_Id).toBe(7); // "X.P_Id" -> bareAlias -> catalog (System[Id] -> number)
    expect(rec.P_Name).toBe("hi"); // a dotless key hits the catalog directly
  });

  it("passes an unknown alias through as a string and nulls a nested unknown", () => {
    const rec = decoderFor(FIELDS)({ U_x: "raw", U_obj: { n: "1" } }) as Record<
      string,
      FieldValue | undefined
    >;
    expect(rec.U_x).toBe("raw");
    expect(rec.U_obj).toBeNull();
  });

  it("catalogued but Data-Type-less (null) fields keep the raw string (ADR-0056)", () => {
    const rec = decoderFor(FIELDS)({ "X.P_Deleted": "1" }) as Record<
      string,
      FieldValue | undefined
    >;
    expect(rec.P_Deleted).toBe("1");
  });
});

describe("read-core — appendPaging（count のガード・RV-28）", () => {
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
