// Read-parameter handling. The inputs here are the exact strings `buildReadUrl` +
// `appendReadQuery` produce, so a change on either side shows up as a failure rather than as a
// silently ignored filter.

import { describe, expect, it } from "vitest";

import { CANDIDATE_DESCRIPTOR } from "../../src/resources/candidate";
import { buildReadUrl } from "../../src/resources/resource";
import { parseReadQuery, runReadQuery } from "./query";
import type { FakeRecord } from "./types";

const FIELDS = CANDIDATE_DESCRIPTOR.fields;
const PREFIX = CANDIDATE_DESCRIPTOR.prefix;
const ctx = { prefix: PREFIX, fields: new Map(Object.entries(FIELDS)) };

const parse = (query: Parameters<typeof buildReadUrl>[3]) =>
  parseReadQuery(
    new URL(buildReadUrl({ host: "fake.test" }, 1, "candidate", query, ctx)),
    PREFIX,
  );

const records: FakeRecord[] = [
  {
    P_Id: "10001",
    P_Name: "山田 太郎",
    P_Owner: "5",
    P_Phase: ["Option.P_Applied"],
    P_UpdateDate: "2026/01/02 03:04:05",
  },
  {
    P_Id: "10002",
    P_Name: "佐藤 次郎",
    P_Owner: "6",
    P_Phase: ["Option.P_Screening", "Option.P_Applied"],
    P_UpdateDate: "2026/02/03 10:20:30",
  },
  {
    P_Id: "10003",
    P_Name: "山田 花子",
    P_Owner: "5",
    P_UpdateDate: "2025/12/31 23:59:59",
  },
];

const run = (query: Parameters<typeof buildReadUrl>[3]) =>
  runReadQuery(records, parse(query), FIELDS);

const ids = (query: Parameters<typeof buildReadUrl>[3]): string[] =>
  run(query).items.map((r) => String(r.P_Id));

describe("parseReadQuery", () => {
  it("splits the field list on top-level commas only", () => {
    // The default field list expands User as `Person.P_Owner(User.P_Id,User.P_Type,…)`.
    const parsed = parse({
      field: [
        "Person.P_Id",
        "Person.P_Owner(User.P_Id,User.P_Type,User.P_Name,User.P_Mail)",
      ],
    });

    expect(parsed.selection).toEqual([
      { alias: "P_Id", sub: [] },
      {
        alias: "P_Owner",
        sub: ["User.P_Id", "User.P_Type", "User.P_Name", "User.P_Mail"],
      },
    ]);
  });

  it("falls back to the primary key when the caller asked for no fields", () => {
    expect(parse({ field: [] }).selection).toEqual([
      { alias: "P_Id", sub: [] },
    ]);
  });

  it("reads condition, order, keywords and paging", () => {
    const parsed = parse({
      condition: { P_Name: { part: "山田" }, P_Id: { ge: 10002 } },
      order: [{ P_Id: "desc" }],
      keywords: ["山田"],
      count: 50,
      start: 10,
    });

    expect(parsed.conditions).toEqual([
      { alias: "P_Name", op: "part", value: "山田" },
      { alias: "P_Id", op: "ge", value: "10002" },
    ]);
    expect(parsed.order).toEqual([{ alias: "P_Id", direction: "desc" }]);
    expect(parsed.keywords).toEqual(["山田"]);
    expect(parsed.count).toBe(50);
    expect(parsed.start).toBe(10);
  });

  it("defaults itemstate to existing and passes a deleted read through", () => {
    expect(parse({}).itemstate).toBe("existing");
    // `deleted` / `all` restrict the condition to P_Id / P_UpdateDate / P_UpdatedBy (the library
    // enforces that before send), so this is what a deleted read actually looks like on the wire.
    expect(
      parse({ itemstate: "all", condition: { P_Id: { eq: 1 } } }).itemstate,
    ).toBe("all");
  });

  it("caps count at the API maximum of 200", () => {
    // 上限超えはライブラリが送信前に弾くようになった（RV-28）ので、buildReadUrl は通らない。
    // ここで見たいのは**サーバー側の**上限処理（ライブラリを使わないクライアントからは
    // count=5000 が実際に届きうる）なので、URL を直接組んで parseReadQuery に渡す。
    const raw = (count: string): number =>
      parseReadQuery(
        new URL(`https://fake.test/v1/candidate?partition=1&count=${count}`),
        PREFIX,
      ).count;
    expect(raw("5000")).toBe(200);
    expect(parse({}).count).toBe(200); // 未指定はライブラリのページ幅（200）
  });
});

describe("runReadQuery", () => {
  it("matches text with part / full", () => {
    expect(ids({ condition: { P_Name: { part: "山田" } } })).toEqual([
      "10001",
      "10003",
    ]);
    expect(ids({ condition: { P_Name: { full: "山田" } } })).toEqual([]);
    expect(ids({ condition: { P_Name: { full: "山田 太郎" } } })).toEqual([
      "10001",
    ]);
  });

  it("compares ids and dates numerically / chronologically", () => {
    expect(ids({ condition: { P_Id: { eq: 10002 } } })).toEqual(["10002"]);
    expect(ids({ condition: { P_Id: { gt: 10001, le: 10003 } } })).toEqual([
      "10002",
      "10003",
    ]);
    expect(
      ids({ condition: { P_UpdateDate: { ge: "2026-01-01T00:00:00Z" } } }),
    ).toEqual(["10001", "10002"]);
  });

  it("matches Option sets with or / and, and references by id", () => {
    expect(
      ids({ condition: { P_Phase: { or: ["Option.P_Applied"] } } }),
    ).toEqual(["10001", "10002"]);
    expect(
      ids({
        condition: {
          P_Phase: { and: ["Option.P_Applied", "Option.P_Screening"] },
        },
      }),
    ).toEqual(["10002"]);
    expect(ids({ condition: { P_Owner: { eq: 5 } } })).toEqual([
      "10001",
      "10003",
    ]);
  });

  it("ANDs keywords across the record's values", () => {
    expect(ids({ keywords: ["山田", "花子"] })).toEqual(["10003"]);
    expect(ids({ keywords: ["山田", "居ない"] })).toEqual([]);
  });

  it("orders, then pages, and reports the pre-paging total", () => {
    expect(ids({ order: [{ P_UpdateDate: "asc" }] })).toEqual([
      "10003",
      "10001",
      "10002",
    ]);

    const paged = run({ order: [{ P_Id: "desc" }], count: 2, start: 1 });
    expect(paged.items.map((r) => String(r.P_Id))).toEqual(["10002", "10001"]);
    expect(paged.total).toBe(3);
  });

  it("returns nothing for itemstate=deleted — there is no delete API", () => {
    expect(run({ itemstate: "deleted" })).toEqual({ items: [], total: 0 });
    expect(ids({ itemstate: "all" })).toHaveLength(3);
  });

  it("does not match a record that lacks the field", () => {
    expect(
      ids({ condition: { P_Phase: { or: ["Option.P_Applied"] } } }),
    ).not.toContain("10003");
  });
});
