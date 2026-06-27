import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import type { DataType } from "../xml/decode";
import { appendReadQuery, type SearchQuery } from "./query";

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
  });

  it("omits an empty keywords list", () => {
    expect(encode({ keywords: [] }).get("keywords")).toBeNull();
  });
});

describe("appendReadQuery — itemstate", () => {
  it("sets deleted / all but omits existing and undefined", () => {
    expect(encode({ itemstate: "deleted" }).get("itemstate")).toBe("deleted");
    expect(encode({ itemstate: "all" }).get("itemstate")).toBe("all");
    expect(encode({ itemstate: "existing" }).get("itemstate")).toBeNull();
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

  it("rejects a non-standard condition field when deleted/all", () => {
    let err: unknown;
    try {
      encode({ itemstate: "deleted", condition: { P_Name: { part: "x" } } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).category).toBe("config");
    expect((err as PortersConfigError).message).toContain("P_Name");
  });
});
