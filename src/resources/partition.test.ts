import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import { createPartitionResource } from "./partition";

// Fixture from the canonical Partition Read sample (115012006227).
const ONE =
  `<?xml version="1.0"?><Partition Total="1" Count="1" Start="0"><Code>0</Code>` +
  `<Item><Partition.P_Id>999999</Partition.P_Id><Partition.P_Name>Company Name</Partition.P_Name>` +
  `<Partition.P_CompanyId>My Company Id</Partition.P_CompanyId></Item></Partition>`;

const page = (total: number, ids: number[]): string =>
  `<Partition Total="${total}" Count="${ids.length}" Start="0"><Code>0</Code>` +
  ids
    .map((id) => `<Item><Partition.P_Id>${id}</Partition.P_Id></Item>`)
    .join("") +
  `</Partition>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (bodies: string[], calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(bodies.shift() ?? ""));
  },
});

const res = (calls: Call[], ...bodies: string[]) =>
  createPartitionResource({
    requester: stub(bodies.length > 0 ? bodies : [ONE], calls),
    host: "h.test",
  });

const collect = async <T>(it: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
};

describe("createPartitionResource", () => {
  it("search() defaults to request_type=1 (accessible list) and sends no partition param", async () => {
    const calls: Call[] = [];
    const p = (await res(calls).search()).items[0];
    const url = calls[0].req.url;
    expect(calls[0].req.method).toBe("GET");
    expect(url).toBe("https://h.test/v1/partition?request_type=1");
    expect(url).not.toContain("partition=");
    expect(p.P_Id).toBe(999999); // System[Id] -> number
    expect(p.P_Name).toBe("Company Name");
    expect(p.P_CompanyId).toBe("My Company Id");
  });

  it("passes request_type / count / start through", async () => {
    const calls: Call[] = [];
    await res(calls).search({ requestType: 0, count: 5, start: 10 });
    const url = calls[0].req.url;
    expect(url).toContain("request_type=0");
    expect(url).toContain("count=5");
    expect(url).toContain("start=10");
  });

  it("searchAll() pages by 200 until total is reached", async () => {
    const calls: Call[] = [];
    const r = createPartitionResource({
      requester: stub([page(3, [1, 2]), page(3, [3])], calls),
      host: "h.test",
    });
    const items = await collect(r.searchAll());
    expect(items.map((p) => p.P_Id)).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(2);
    expect(calls[0].req.url).toContain("count=200");
    expect(calls[0].req.url).toContain("start=0");
    expect(calls[1].req.url).toContain("start=2");
  });
});
