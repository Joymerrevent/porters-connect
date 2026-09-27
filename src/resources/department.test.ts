import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import { createDepartmentResource } from "./department";

// Fixture from the canonical Department Read sample (43464258000793).
const TWO =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Department Total="2" Count="2" Start="0"><Code>0</Code>` +
  `<Item><Department.P_Id>1</Department.P_Id><Department.P_Name>部署1</Department.P_Name></Item>` +
  `<Item><Department.P_Id>2</Department.P_Id><Department.P_Name>部署2</Department.P_Name></Item>` +
  `</Department>`;

const page = (total: number, ids: number[], start = 0): string =>
  `<Department Total="${total}" Count="${ids.length}" Start="${start}"><Code>0</Code>` +
  ids
    .map((id) => `<Item><Department.P_Id>${id}</Department.P_Id></Item>`)
    .join("") +
  `</Department>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (bodies: string[], calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(bodies.shift() ?? ""));
  },
});

const res = (calls: Call[], ...bodies: string[]) =>
  createDepartmentResource({
    requester: stub(bodies.length > 0 ? bodies : [TWO], calls),
    accessPoint: { hostname: "h.test" },
    partition: 12,
  });

const collect = async <T>(it: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
};

describe("createDepartmentResource", () => {
  it("search() sends partition and decodes the sample page", async () => {
    const calls: Call[] = [];
    const page = await res(calls).search();
    const url = calls[0].req.url;
    expect(url).toContain("https://h.test/v1/department?");
    expect(url).toContain("partition=12");
    // No request_type / user_type: Department Read has no filter (docs/usage/reference).
    expect(url).not.toContain("request_type");
    expect(url).not.toContain("user_type");
    expect(page.total).toBe(2);
    expect(page.items.map((d) => d.P_Id)).toEqual([1, 2]);
    expect(page.items[1].P_Name).toBe("部署2");
  });

  it("sends the catalog default when field is omitted (ADR-0020)", async () => {
    // A fieldless Department Read answers with P_Id alone, so the library asks for every
    // catalogued field — otherwise the record type promises 6 and delivers 1 (RV-1).
    const calls: Call[] = [];
    await res(calls).search();
    const field = new URL(calls[0].req.url).searchParams.get("field");
    expect(field).toBe(
      [
        "Department.P_Id",
        "Department.P_Name",
        "Department.P_Hidden",
        "Department.P_SortNo",
        "Department.P_RegistrationDate",
        "Department.P_UpdateDate",
      ].join(","),
    );
  });

  it("decodes every field by its Data Type", async () => {
    const calls: Call[] = [];
    const body =
      `<?xml version="1.0"?><Department Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<Department.P_Id>3</Department.P_Id>` +
      `<Department.P_Name>営業部</Department.P_Name>` +
      `<Department.P_Hidden>1</Department.P_Hidden>` +
      `<Department.P_SortNo>10</Department.P_SortNo>` +
      `<Department.P_RegistrationDate>2026/04/01 09:30:00</Department.P_RegistrationDate>` +
      `<Department.P_UpdateDate/>` +
      `</Item></Department>`;
    const d = (await res(calls, body).search()).items[0];
    expect(d?.P_Id).toBe(3);
    expect(d?.P_Name).toBe("営業部");
    expect(d?.P_Hidden).toBe(1); // Number
    expect(d?.P_SortNo).toBe(10); // Number
    expect(d?.P_RegistrationDate).toBe("2026-04-01T09:30:00Z"); // System[DateTime] -> ISO(UTC)
    expect(d?.P_UpdateDate).toBeNull(); // 空要素は null
  });

  it("passes field / count / start through", async () => {
    const calls: Call[] = [];
    await res(calls).search({
      // Bare alias in, `Department.` prefix added by the library (ADR-0059).
      field: ["P_Name", "P_SortNo"],
      count: 5,
      start: 2,
    });
    const url = decodeURIComponent(calls[0].req.url);
    expect(url).toContain("field=Department.P_Name,Department.P_SortNo");
    expect(url).toContain("count=5");
    expect(url).toContain("start=2");
  });

  it("treats an empty field array as PORTERS' own default (no field param)", async () => {
    // `[]` は「API ネイティブの答えに委ねる」＝ PORTERS 既定の P_Id だけ。
    const calls: Call[] = [];
    await res(calls).search({ field: [] });
    expect(calls[0].req.url).not.toContain("field=");
  });

  it("searchAll() pages by 200 until total is reached", async () => {
    const calls: Call[] = [];
    const r = createDepartmentResource({
      requester: stub([page(3, [1, 2]), page(3, [3], 2)], calls),
      accessPoint: { hostname: "h.test" },
      partition: 12,
    });
    const ids = (await collect(r.searchAll())).map((d) => d.P_Id);
    expect(ids).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(2);
    expect(calls[0].req.url).toContain("count=200");
    expect(calls[0].req.url).toContain("start=0");
    expect(calls[1].req.url).toContain("start=2");
  });

  it("searchAll() keeps the field selection on every page (RV-32)", async () => {
    const calls: Call[] = [];
    const r = createDepartmentResource({
      requester: stub([page(2, [1]), page(2, [2], 1)], calls),
      accessPoint: { hostname: "h.test" },
      partition: 12,
    });
    await collect(r.searchAll({ field: ["P_Name"] }));
    for (const c of calls) {
      expect(decodeURIComponent(c.req.url)).toContain(
        "field=Department.P_Name",
      );
    }
  });

  it("has no get() and no write methods (read-only master, no Write API)", () => {
    const calls: Call[] = [];
    const r = res(calls) as unknown as Record<string, unknown>;
    expect(r.get).toBeUndefined();
    expect(r.create).toBeUndefined();
    expect(r.update).toBeUndefined();
  });
});
