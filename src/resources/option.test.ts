import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import { createOptionResource } from "./option";

// Fixture from the canonical Option Read sample (115012160328): the 性別 group with two
// children. Note no Total/Count/Start attributes and the recursive <Items> nesting.
const GENDER =
  `<?xml version="1.0"?><Option><Code>0</Code>` +
  `<Item><Option.P_Id>22</Option.P_Id><Option.P_Name>性別</Option.P_Name><Option.P_Alias>Option.P_Gender</Option.P_Alias>` +
  `<Option.P_ParentId>0</Option.P_ParentId><Option.P_Type>0</Option.P_Type><Option.P_Order>1</Option.P_Order>` +
  `<Items>` +
  `<Item><Option.P_Id>52</Option.P_Id><Option.P_Name>男性</Option.P_Name><Option.P_Alias>Option.P_Male</Option.P_Alias>` +
  `<Option.P_ParentId>22</Option.P_ParentId><Option.P_Type>0</Option.P_Type><Option.P_Order>1</Option.P_Order><Items/></Item>` +
  `<Item><Option.P_Id>53</Option.P_Id><Option.P_Name>女性</Option.P_Name><Option.P_Alias>Option.P_Female</Option.P_Alias>` +
  `<Option.P_ParentId>22</Option.P_ParentId><Option.P_Type>0</Option.P_Type><Option.P_Order>2</Option.P_Order><Items/></Item>` +
  `</Items></Item></Option>`;

const EMPTY = `<?xml version="1.0"?><Option><Code>0</Code></Option>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const res = (calls: Call[], body: string = GENDER) =>
  createOptionResource({
    requester: stub(body, calls),
    host: "h.test",
    partition: 12,
  });

describe("createOptionResource", () => {
  it("search() sends partition only and flattens the tree depth-first (parent then children)", async () => {
    const calls: Call[] = [];
    const options = await res(calls).search();
    const url = calls[0].req.url;
    expect(url).toBe("https://h.test/v1/option?partition=12");
    // Depth-first: root, then its two children — every node present, none dropped.
    expect(options.map((o) => o.P_Id)).toEqual([22, 52, 53]);
    expect(options.map((o) => o.P_Alias)).toEqual([
      "Option.P_Gender",
      "Option.P_Male",
      "Option.P_Female",
    ]);
    // Parent linkage + order preserved; no nested `Items` leaks onto the record.
    expect(options[1].P_ParentId).toBe(22);
    expect(options[2].P_Order).toBe(2);
    expect("Items" in options[0]).toBe(false);
  });

  it("passes alias / level / enabled / count through", async () => {
    const calls: Call[] = [];
    await res(calls).search({
      alias: "Option.P_Gender",
      level: -1,
      enabled: 1,
      count: 50,
    });
    const url = decodeURIComponent(calls[0].req.url);
    expect(url).toContain("alias=Option.P_Gender");
    expect(url).toContain("level=-1");
    expect(url).toContain("enabled=1");
    expect(url).toContain("count=50");
  });

  it("returns an empty array when there are no items", async () => {
    const calls: Call[] = [];
    expect(await res(calls, EMPTY).search()).toEqual([]);
  });

  it("tolerates a non-record nested item without crashing (defensive)", async () => {
    const body =
      `<?xml version="1.0"?><Option><Code>0</Code><Item><Option.P_Id>1</Option.P_Id>` +
      `<Items><Item>oops</Item></Items></Item></Option>`;
    const calls: Call[] = [];
    const options = await res(calls, body).search();
    expect(options).toHaveLength(2); // root + the malformed child (decoded as an empty record)
    expect(options[0].P_Id).toBe(1);
    expect(options[1].P_Id).toBeUndefined();
  });
});
