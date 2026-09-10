import { describe, expect, expectTypeOf, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import {
  createFieldResource,
  type FieldSearchQuery,
  type ResourceType,
} from "./field";
import { RESOURCE_VALUES, type ResourceName } from "./resource-list";

// Fixture from the canonical Field Read sample (115012160308): two Job fields — one with an
// empty P_ReferTo, one whose P_ReferTo nests the referenced option group alias.
const TWO =
  `<?xml version="1.0"?><Field Total="2" Count="2" Start="0"><Code>0</Code>` +
  `<Item><Field.P_Id>100</Field.P_Id><Field.P_Name>ポジション名</Field.P_Name><Field.P_Alias>Job.P_Position</Field.P_Alias>` +
  `<Field.P_Type>1</Field.P_Type><Field.P_Required>1</Field.P_Required><Field.P_Max>100</Field.P_Max><Field.P_Min>1</Field.P_Min>` +
  `<Field.P_DecimalFraction>0</Field.P_DecimalFraction><Field.P_ReferTo/><Field.P_ResourceType>3</Field.P_ResourceType></Item>` +
  `<Item><Field.P_Id>101</Field.P_Id><Field.P_Name>勤務地</Field.P_Name><Field.P_Alias>Job.P_Area</Field.P_Alias>` +
  `<Field.P_Type>5</Field.P_Type><Field.P_Required>0</Field.P_Required><Field.P_Max/><Field.P_Min/>` +
  `<Field.P_DecimalFraction>0</Field.P_DecimalFraction><Field.P_ReferTo><Option.P_Area/></Field.P_ReferTo><Field.P_ResourceType>3</Field.P_ResourceType></Item>` +
  `</Field>`;

const page = (total: number, ids: number[]): string =>
  `<Field Total="${total}" Count="${ids.length}" Start="0"><Code>0</Code>` +
  ids.map((id) => `<Item><Field.P_Id>${id}</Field.P_Id></Item>`).join("") +
  `</Field>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (bodies: string[], calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(bodies.shift() ?? ""));
  },
});

const res = (calls: Call[], ...bodies: string[]) =>
  createFieldResource({
    requester: stub(bodies.length > 0 ? bodies : [TWO], calls),
    accessPoint: { host: "h.test" },
    partition: 12,
  });

const collect = async <T>(it: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
};

describe("createFieldResource", () => {
  it("maps the resource selector to its Value code and defaults active=-1", async () => {
    const calls: Call[] = [];
    const fields = (await res(calls).search({ resource: "job" })).items;
    const url = calls[0].req.url;
    expect(url).toContain("https://h.test/v1/field?");
    expect(url).toContain("partition=12");
    expect(url).toContain("resource=3"); // job -> 3
    expect(url).toContain("active=-1");
    // P_Max empty -> null; P_ReferTo empty -> null; nested -> referenced alias(es).
    expect(fields[0].P_Id).toBe(100);
    expect(fields[0].P_Required).toBe(1);
    expect(fields[0].P_ReferTo).toBeNull();
    expect(fields[1].P_Max).toBeNull();
    expect(fields[1].P_ReferTo).toEqual(["Option.P_Area"]);
  });

  it("passes a different resource code, active, count and start through", async () => {
    const calls: Call[] = [];
    await res(calls).search({
      resource: "candidate",
      active: 1,
      count: 2,
      start: 5,
    });
    const url = calls[0].req.url;
    expect(url).toContain("resource=1"); // candidate -> 1
    expect(url).toContain("active=1");
    expect(url).toContain("count=2");
    expect(url).toContain("start=5");
  });

  it("searchAll() pages by 200 until total is reached", async () => {
    const calls: Call[] = [];
    const r = createFieldResource({
      requester: stub([page(3, [1, 2]), page(3, [3])], calls),
      accessPoint: { host: "h.test" },
      partition: 12,
    });
    const items = await collect(r.searchAll({ resource: "job" }));
    expect(items.map((f) => f.P_Id)).toEqual([1, 2, 3]);
    expect(calls[0].req.url).toContain("count=200");
    expect(calls[1].req.url).toContain("start=2");
  });

  it("walks the query as handed over: mutating it mid-iteration cannot change a later page (RV-32)", async () => {
    const calls: Call[] = [];
    const r = createFieldResource({
      requester: stub([page(3, [1, 2]), page(3, [3])], calls),
      accessPoint: { host: "h.test" },
      partition: 12,
    });
    const query: Omit<FieldSearchQuery, "count" | "start"> = {
      resource: "job",
      active: 1,
    };
    for await (const item of r.searchAll(query)) {
      expect(item.P_Id).toBeGreaterThan(0);
      query.resource = "candidate";
      query.active = 0;
    }
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      const url = new URL(c.req.url);
      expect(url.pathname).toBe("/v1/field");
      const p = url.searchParams;
      expect(p.get("resource")).toBe(String(RESOURCE_VALUES.job));
      expect(p.get("active")).toBe("1");
    }
  });
});

// RV-37: `field.ts` used to keep its own copy of the Resource List and silently lost Process.
// The copy is gone (`ResourceType` is now an alias of `ResourceName`), and these fix that it
// stays gone — the drift happened because only `resource-list.test.ts` asked "is it complete?".
describe("ResourceType (Field Read's resource selector)", () => {
  it("covers every resource PORTERS gives a Value — Process included (RV-37)", () => {
    expectTypeOf<"process">().toExtend<ResourceType>();
    // The full set, so dropping one is a failure here and not just a missing feature.
    expectTypeOf<
      | "candidate"
      | "job"
      | "client"
      | "process"
      | "recruiter"
      | "sales"
      | "contract"
      | "resume"
      | "activity"
      | "opportunity"
      | "contact"
    >().toEqualTypeOf<ResourceType>();
  });

  it("is the same set as `ResourceName`, not a second table (RV-37)", () => {
    expectTypeOf<ResourceType>().toEqualTypeOf<ResourceName>();
  });

  it("excludes what PORTERS gives no Value (Phase / Attachment / masters)", () => {
    expectTypeOf<"phase">().not.toExtend<ResourceType>();
    expectTypeOf<"attachment">().not.toExtend<ResourceType>();
    expectTypeOf<"field">().not.toExtend<ResourceType>();
  });

  it("reads the Value from the one table, so `resource=` cannot drift", () => {
    // Not a restatement of RESOURCE_VALUES: it fixes that *this* accessor sends what that
    // table says, which is the link that broke.
    expect(RESOURCE_VALUES.process).toBe(7);
    expect(Object.keys(RESOURCE_VALUES)).toHaveLength(11);
  });
});
