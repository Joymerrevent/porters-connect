import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import { createFieldResource } from "./field";

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
    host: "h.test",
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
      host: "h.test",
      partition: 12,
    });
    const items = await collect(r.searchAll({ resource: "job" }));
    expect(items.map((f) => f.P_Id)).toEqual([1, 2, 3]);
    expect(calls[0].req.url).toContain("count=200");
    expect(calls[1].req.url).toContain("start=2");
  });
});
