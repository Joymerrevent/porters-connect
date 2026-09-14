import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";

import type { FieldValue } from "../xml/decode";
import {
  appendPaging,
  decoderFor,
  paginateOnce,
  rawValue,
  type FieldCatalog,
} from "./read-core";

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

describe("read-core — paginateOnce", () => {
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
describe("rawValue — カタログ外の値を読む（ADR-0074 D2）", () => {
  const record = decoderFor({ P_Name: "SinglelineText" } as const)({
    P_Name: "山田 太郎",
    U_memo: "面談済み",
    U_empty: "",
    U_nested: { "Option.P_Foo": "" },
  });

  it("生の文字列をそのまま返す（変換しない）", () => {
    expect(rawValue(record, "U_memo")).toBe("面談済み");
  });

  it("応答に無い alias は undefined（「空」と区別する）", () => {
    expect(rawValue(record, "U_unknown")).toBeUndefined();
  });

  it("スカラでない値（入れ子）は null", () => {
    expect(rawValue(record, "U_nested")).toBeNull();
  });

  it("空の要素は空文字のまま（レコードが持っているものを返す）", () => {
    expect(rawValue(record, "U_empty")).toBe("");
  });

  it("カタログ済みの項目も読めるが、変換後の値が string でなければ null", () => {
    expect(rawValue(record, "P_Name")).toBe("山田 太郎");
    const numeric = decoderFor({ P_Score: "Number" } as const)({
      P_Score: "80",
    });
    expect(rawValue(numeric, "P_Score")).toBeNull(); // number は string ではない
  });

  it("レコードでないものを渡しても落ちない", () => {
    expect(rawValue(undefined, "U_memo")).toBeUndefined();
    expect(rawValue(null, "U_memo")).toBeUndefined();
    expect(rawValue("scalar", "U_memo")).toBeUndefined();
    expect(rawValue([1, 2], "U_memo")).toBeUndefined();
  });
});
