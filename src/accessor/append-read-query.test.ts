import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import type { DataType } from "../porters/data-type";
import type { SearchQuery } from "./query";
import { appendReadQuery } from "./append-read-query";

// A synthetic catalog with one field per condition group, exercising every Data-Type branch
// of the encoder (decode/encode value tests live in their own files; here we test the query).
const FIELDS = {
  P_Id: "System[Id]",
  P_Num: "Number",
  P_When: "DateTime",
  P_Day: "Date",
  P_Age: "Age",
  P_Name: "SinglelineText",
  P_Phase: "Option",
  P_Owner: "User",
  P_Ref: "System[Reference]",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
} as const satisfies Record<string, DataType>;

const ctx = {
  prefix: "W",
  fields: new Map<string, DataType>(Object.entries(FIELDS)),
};

// Encode a typed query and return the resulting params (values are stored decoded).
const encode = (q: SearchQuery<typeof FIELDS>): URLSearchParams => {
  const p = new URLSearchParams();
  appendReadQuery(p, q, ctx);
  return p;
};

describe("appendReadQuery — condition", () => {
  it("numeric Id comparisons are prefixed and ordered by key", () => {
    const p = encode({ condition: { P_Id: { ge: 100, lt: 200 } } });
    expect(p.get("condition")).toBe("W.P_Id:ge=100,W.P_Id:lt=200");
  });

  it("Id `or` joins a set of ids with colons", () => {
    expect(
      encode({ condition: { P_Id: { or: [1, 2, 3] } } }).get("condition"),
    ).toBe("W.P_Id:or=1:2:3");
  });

  it("Number takes a scalar comparison", () => {
    expect(encode({ condition: { P_Num: { gt: 5 } } }).get("condition")).toBe(
      "W.P_Num:gt=5",
    );
  });

  it("DateTime / System[DateTime] values are normalised ISO -> PORTERS", () => {
    expect(
      encode({ condition: { P_When: { ge: "2026-01-01T00:00:00Z" } } }).get(
        "condition",
      ),
    ).toBe("W.P_When:ge=2026/01/01 00:00:00");
    expect(
      encode({
        condition: { P_UpdateDate: { le: "2026-03-18T09:30:00Z" } },
      }).get("condition"),
    ).toBe("W.P_UpdateDate:le=2026/03/18 09:30:00");
  });

  it("Date / Age values are normalised ISO -> PORTERS date", () => {
    expect(
      encode({ condition: { P_Day: { eq: "2026-01-01" } } }).get("condition"),
    ).toBe("W.P_Day:eq=2026/01/01");
    expect(
      encode({ condition: { P_Age: { ge: "1990-12-31" } } }).get("condition"),
    ).toBe("W.P_Age:ge=1990/12/31");
  });

  it("Text supports full / part", () => {
    expect(
      encode({ condition: { P_Name: { part: "山田", full: "山田太郎" } } }).get(
        "condition",
      ),
    ).toBe("W.P_Name:part=山田,W.P_Name:full=山田太郎");
  });

  it("Option joins option aliases with colons", () => {
    expect(
      encode({
        condition: { P_Phase: { or: ["Option.P_A", "Option.P_B"] } },
      }).get("condition"),
    ).toBe("W.P_Phase:or=Option.P_A:Option.P_B");
  });

  it("User / System[Reference] match by id (eq one, or/and a set)", () => {
    expect(encode({ condition: { P_Owner: { eq: 5 } } }).get("condition")).toBe(
      "W.P_Owner:eq=5",
    );
    expect(
      encode({ condition: { P_Owner: { and: [1, 2] } } }).get("condition"),
    ).toBe("W.P_Owner:and=1:2");
    expect(
      encode({ condition: { P_Ref: { eq: 10008 } } }).get("condition"),
    ).toBe("W.P_Ref:eq=10008");
  });

  it("joins multiple fields with a comma (AND)", () => {
    expect(
      encode({
        condition: { P_Id: { eq: 1 }, P_Name: { part: "x" } },
      }).get("condition"),
    ).toBe("W.P_Id:eq=1,W.P_Name:part=x");
  });

  it("skips an undefined operator value and an undefined field entry", () => {
    expect(
      encode({
        condition: { P_Id: { eq: undefined, ge: 5 }, P_Num: undefined },
      }).get("condition"),
    ).toBe("W.P_Id:ge=5");
  });

  it("omits an empty condition object", () => {
    expect(encode({ condition: {} }).get("condition")).toBeNull();
  });
});

describe("appendReadQuery — order", () => {
  it("encodes one object's keys in order", () => {
    expect(
      encode({ order: [{ P_When: "desc", P_Id: "asc" }] }).get("order"),
    ).toBe("W.P_When:desc,W.P_Id:asc");
  });

  it("flattens multiple order objects in array order", () => {
    expect(
      encode({ order: [{ P_When: "desc" }, { P_Day: "asc" }] }).get("order"),
    ).toBe("W.P_When:desc,W.P_Day:asc");
  });

  it("skips an undefined direction and omits an empty order", () => {
    expect(
      encode({ order: [{ P_When: undefined, P_Id: "asc" }] }).get("order"),
    ).toBe("W.P_Id:asc");
    expect(encode({ order: [] }).get("order")).toBeNull();
  });
});

describe("appendReadQuery — keywords", () => {
  // 空の要素は空のキーワードとして送られるので、送る前に拒否する（RV-97）。
  it.each([[["a", ""]], [["", "b"]], [[" "]], [["a", "\t"]]])(
    "refuses an empty keyword in %j",
    (keywords) => {
      let err: unknown;
      try {
        encode({ keywords });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(PortersConfigError);
      expect((err as PortersConfigError).message).toMatch(
        /^keywords has an empty keyword "/,
      );
      expect((err as PortersConfigError).hint).toBe(
        "Remove the empty keyword, or leave keywords out to search without one.",
      );
      expect((err as PortersConfigError).context).toEqual({
        operation: "read",
      });
    },
  );

  it("joins keywords with commas (AND)", () => {
    expect(encode({ keywords: ["foo", "bar"] }).get("keywords")).toBe(
      "foo,bar",
    );
  });

  it("allows exactly 100 characters including commas", () => {
    const kw = ["a".repeat(50), "b".repeat(49)]; // 50 + 1 + 49 = 100
    expect(encode({ keywords: kw }).get("keywords")).toHaveLength(100);
  });

  it("throws PortersConfigError over 100 characters", () => {
    let err: unknown;
    try {
      encode({ keywords: ["a".repeat(101)] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).category).toBe("config");
    // 何文字で、上限が何文字か（数字が入っていれば利用者は詰められる）。
    expect((err as PortersConfigError).message).toContain(
      "keywords is 101 characters, over the 100-character limit",
    );
    expect((err as PortersConfigError).hint).toContain("100 characters");
  });

  it("omits an empty keywords list", () => {
    expect(encode({ keywords: [] }).get("keywords")).toBeNull();
  });
});

describe("appendReadQuery — itemstate", () => {
  it("sends every explicit itemstate — including existing (ADR-0057)", () => {
    expect(encode({ itemstate: "deleted" }).get("itemstate")).toBe("deleted");
    expect(encode({ itemstate: "all" }).get("itemstate")).toBe("all");
    // 明示指定は畳まない。省略と `existing` は別の意思表示で、PORTERS が既定を変えた日に
    // 「生存のみが欲しい」と言った利用者が黙って削除済みを受け取らないようにするため。
    expect(encode({ itemstate: "existing" }).get("itemstate")).toBe("existing");
  });

  it("omits itemstate only when the caller omits it (defer to the API default)", () => {
    expect(encode({}).get("itemstate")).toBeNull();
  });

  it("allows the 3 standard fields in condition when deleted/all", () => {
    const p = encode({
      itemstate: "all",
      condition: {
        P_Id: { eq: 1 },
        P_UpdateDate: { ge: "2026-01-01T00:00:00Z" },
        P_UpdatedBy: { eq: 2 },
      },
    });
    expect(p.get("itemstate")).toBe("all");
    expect(p.get("condition")).toBe(
      "W.P_Id:eq=1,W.P_UpdateDate:ge=2026/01/01 00:00:00,W.P_UpdatedBy:eq=2",
    );
  });

  // Both restricted states, separately: the check reads `deleted || all`, and pinning only one
  // side leaves the other free to drop out (the mutant `itemstate === ""` survived on "all").
  it.each(["deleted", "all"] as const)(
    "rejects a non-standard condition field when itemstate is %s",
    (itemstate) => {
      let err: unknown;
      try {
        encode({ itemstate, condition: { P_Name: { part: "x" } } });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(PortersConfigError);
      expect((err as PortersConfigError).category).toBe("config");
      expect((err as PortersConfigError).message).toContain("P_Name");
      expect((err as PortersConfigError).message).toContain(itemstate);
      // 許される 3 項目を hint が名指しする。
      expect((err as PortersConfigError).hint).toContain(
        "P_Id, P_UpdateDate, P_UpdatedBy",
      );
    },
  );

  it("does not restrict the condition when itemstate is existing or omitted", () => {
    // The restriction is a fact about deleted reads only (reference: itemstate=deleted/all).
    expect(
      encode({
        itemstate: "existing",
        condition: { P_Name: { part: "x" } },
      }).get("condition"),
    ).toBe("W.P_Name:part=x");
    expect(
      encode({ condition: { P_Name: { part: "x" } } }).get("condition"),
    ).toBe("W.P_Name:part=x");
  });
});

// RV-36: condition の日時も変換するので、変換できない値は素の RangeError ではなく
// PortersError の系統で届く（ガイドが勧める instanceof PortersError の分岐で捕まる）。
describe("condition の変換できない日時（RV-36）", () => {
  it("ISO でない日付は PortersConfigError（category: validation）", () => {
    expect(() =>
      encode({ condition: { P_Day: { ge: "not-a-date" } } }),
    ).toThrow(PortersConfigError);
  });

  it("どの項目かをメッセージに載せ、原因を cause に残す", () => {
    try {
      encode({ condition: { P_When: { ge: "nope" } } });
      expect.unreachable();
    } catch (e) {
      const err = e as PortersConfigError;
      expect(err.category).toBe("validation");
      expect(err.message).toContain("P_When");
      expect(err.hint).toContain("ISO 8601");
      expect(err.context).toEqual({ operation: "read" });
      expect(err.cause).toBeInstanceOf(RangeError);
    }
  });

  it("DateTime の条件も、日付だけ・ゾーンの無い値は弾く", () => {
    expect(() =>
      encode({ condition: { P_When: { ge: "2026-09-10" } } }),
    ).toThrow(PortersConfigError);
    try {
      encode({ condition: { P_When: { ge: "2026-09-10T00:00:00" } } });
      expect.unreachable();
    } catch (e) {
      expect((e as PortersConfigError).hint).toContain("a time and a zone");
    }
  });

  it("Age も同じ経路", () => {
    expect(() => encode({ condition: { P_Age: { eq: "nope" } } })).toThrow(
      PortersConfigError,
    );
  });
});

// RV-74。空の一覧は `or=`（値なし）として送られていた。PORTERS がそれをどう読むかは分からない。
describe("condition の空の一覧（RV-74）", () => {
  it.each(["or", "and"] as const)(
    "P_Phase の %s に空の一覧を渡すと、送信前に弾く",
    (op) => {
      let err: unknown;
      try {
        encode({ condition: { P_Phase: { [op]: [] } } });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(PortersConfigError);
      expect((err as PortersConfigError).message).toBe(
        "condition P_Phase: the list of values is empty",
      );
      expect((err as PortersConfigError).category).toBe("config");
      expect((err as PortersConfigError).hint).toContain("at least one value");
      expect((err as PortersConfigError).context).toEqual({
        operation: "read",
      });
    },
  );

  it("1 つでも値があれば通る", () => {
    expect(
      encode({ condition: { P_Phase: { or: ["Option.P_A"] } } }).get(
        "condition",
      ),
    ).toBe("W.P_Phase:or=Option.P_A");
  });
});

// ADR-0105・RV-68。区切り文字を含む値は、値の途中から別の条件（またはキーワード・一覧の値）として
// 読まれる。PORTERS はエスケープの方法を示していないので、送る前に拒否する。
describe("区切り文字を含む値（ADR-0105・RV-68）", () => {
  const errorOf = (q: SearchQuery<typeof FIELDS>): PortersConfigError => {
    try {
      encode(q);
    } catch (e) {
      return e as PortersConfigError;
    }
    throw new Error("expected encode to throw");
  };

  it("テキストの値のカンマを弾く（別の条件として読まれるため）", () => {
    const e = errorOf({
      condition: { P_Name: { part: "山田,Person.P_Owner:eq=5" } },
    });
    expect(e).toBeInstanceOf(PortersConfigError);
    expect(e.message).toBe(
      'condition P_Name: "山田,Person.P_Owner:eq=5" contains a comma, which PORTERS reads as a separator',
    );
    expect(e.category).toBe("config");
    expect(e.hint).toContain("narrow the results yourself");
    expect(e.context).toEqual({ operation: "read" });
  });

  it("削除済みを読むときの項目の制限も、値の細工で越えられない", () => {
    const e = errorOf({
      itemstate: "deleted",
      condition: { P_UpdatedBy: { eq: "1,W.P_Name:part=x" } as never },
    });
    expect(e.message).toContain("contains a comma");
  });

  it.each([
    ["Option.P_A,Option.P_B", "a comma or a colon"],
    ["Option.P_A:Option.P_B", "a comma or a colon"],
  ])(
    "一覧の要素 %s を弾く（値どうしの区切りとして読まれるため）",
    (value, what) => {
      const e = errorOf({ condition: { P_Phase: { or: [value] } } });
      expect(e.message).toBe(
        `condition P_Phase: ${JSON.stringify(value)} contains ${what}, which PORTERS reads as a separator`,
      );
    },
  );

  it("日時の値のコロンは弾かない（HH:MM:SS を含むため）", () => {
    expect(
      encode({ condition: { P_When: { ge: "2026-09-26T00:00:00Z" } } }).get(
        "condition",
      ),
    ).toBe("W.P_When:ge=2026/09/26 00:00:00");
  });

  it("テキストの値のコロンは弾かない", () => {
    expect(
      encode({ condition: { P_Name: { part: "12:00" } } }).get("condition"),
    ).toBe("W.P_Name:part=12:00");
  });

  it("キーワードの要素のカンマを弾く（キーワードが 1 つ増えるため）", () => {
    const e = errorOf({ keywords: ["営業", "東京,大阪"] });
    expect(e.message).toBe(
      'keywords: "東京,大阪" contains a comma, which PORTERS reads as a separator',
    );
  });
});

// RV-68 の再レビュー。演算子（キー）や項目名に区切り文字を入れると、値と同じく別の条件として読まれた。
describe("condition のキー（演算子と項目名）", () => {
  const errorOf = (q: unknown): PortersConfigError => {
    try {
      encode(q as SearchQuery<typeof FIELDS>);
    } catch (e) {
      return e as PortersConfigError;
    }
    throw new Error("expected encode to throw");
  };

  it("演算子の細工で、削除済みを読むときの項目の制限を越えられない", () => {
    const e = errorOf({
      itemstate: "deleted",
      condition: { P_Id: { "eq=1,W.P_Name:part": "x" } },
    });
    expect(e.message).toBe(
      'condition P_Id: unknown operator "eq=1,W.P_Name:part"',
    );
    expect(e.category).toBe("config");
    expect(e.hint).toBe(
      "Use one of eq, gt, ge, le, lt, part, full, or, and; which ones a field takes depends on its Data Type.",
    );
    expect(e.context).toEqual({ operation: "read" });
  });

  it("知らない演算子を弾く", () => {
    expect(errorOf({ condition: { P_Name: { like: "x" } } }).message).toBe(
      'condition P_Name: unknown operator "like"',
    );
  });

  it.each(["P_Name,W.P_Id", "P_Name:part", "P_Name=x"])(
    "区切り文字を含む項目名 %s を弾く",
    (alias) => {
      const e = errorOf({ condition: { [alias]: { part: "x" } } });
      expect(e.message).toBe(
        `condition: ${JSON.stringify(alias)} contains a comma, a colon or an equals sign, which PORTERS reads as a separator`,
      );
    },
  );

  it.each(["eq", "gt", "ge", "le", "lt"] as const)(
    "数の演算子 %s は通る",
    (op) => {
      expect(
        encode({ condition: { P_Num: { [op]: 1 } } }).get("condition"),
      ).toBe(`W.P_Num:${op}=1`);
    },
  );

  it.each(["part", "full"] as const)("テキストの演算子 %s は通る", (op) => {
    expect(
      encode({ condition: { P_Name: { [op]: "x" } } }).get("condition"),
    ).toBe(`W.P_Name:${op}=x`);
  });

  it.each(["or", "and"] as const)("一覧の演算子 %s は通る", (op) => {
    expect(
      encode({ condition: { P_Phase: { [op]: ["Option.P_A"] } } }).get(
        "condition",
      ),
    ).toBe(`W.P_Phase:${op}=Option.P_A`);
  });
});
