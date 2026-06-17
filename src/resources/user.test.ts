import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import { createUserResource } from "./user";

// Fixture from the canonical User Read sample (115012160288).
const TWO =
  `<?xml version="1.0"?><User Total="2" Count="2" Start="0"><Code>0</Code>` +
  `<Item><User.P_Type>0</User.P_Type><User.P_Id>1</User.P_Id><User.P_Name>ユーザー1</User.P_Name><User.P_Mail>user1@xxx.co.jp</User.P_Mail></Item>` +
  `<Item><User.P_Type>1</User.P_Type><User.P_Id>2</User.P_Id><User.P_Name>ユーザー2</User.P_Name><User.P_Mail>user2@xxx.co.jp</User.P_Mail></Item>` +
  `</User>`;

const ME =
  `<?xml version="1.0"?><User Total="1" Count="1" Start="0"><Code>0</Code>` +
  `<Item><User.P_Type>1</User.P_Type><User.P_Id>9</User.P_Id><User.P_Name>App User</User.P_Name><User.P_Mail>app@xxx.co.jp</User.P_Mail></Item></User>`;

const page = (total: number, ids: number[]): string =>
  `<User Total="${total}" Count="${ids.length}" Start="0"><Code>0</Code>` +
  ids.map((id) => `<Item><User.P_Id>${id}</User.P_Id></Item>`).join("") +
  `</User>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (bodies: string[], calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(bodies.shift() ?? ""));
  },
});

const res = (calls: Call[], ...bodies: string[]) =>
  createUserResource({
    requester: stub(bodies.length > 0 ? bodies : [TWO], calls),
    host: "h.test",
    partition: 12,
  });

const collect = async <T>(it: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
};

describe("createUserResource", () => {
  it("search() defaults to partition + request_type=1 + user_type=-1 and omits field", async () => {
    const calls: Call[] = [];
    const users = (await res(calls).search()).items;
    const url = calls[0].req.url;
    expect(url).toContain("https://h.test/v1/user?");
    expect(url).toContain("partition=12");
    expect(url).toContain("request_type=1");
    expect(url).toContain("user_type=-1");
    expect(url).not.toContain("field=");
    expect(users.map((u) => u.P_Id)).toEqual([1, 2]);
    expect(users[0].P_Type).toBe(0); // Number
    expect(users[1].P_Mail).toBe("user2@xxx.co.jp"); // Mail
  });

  it("passes userType / field / count / start through", async () => {
    const calls: Call[] = [];
    await res(calls).search({
      requestType: 1,
      userType: 0,
      field: ["User.P_Name"],
      count: 5,
      start: 2,
    });
    const url = decodeURIComponent(calls[0].req.url);
    expect(url).toContain("user_type=0");
    expect(url).toContain("field=User.P_Name");
    expect(url).toContain("count=5");
    expect(url).toContain("start=2");
  });

  it("treats an empty field array as omitted (no field param)", async () => {
    const calls: Call[] = [];
    await res(calls).search({ field: [] });
    expect(calls[0].req.url).not.toContain("field=");
  });

  it("current() sends request_type=0 and returns the single (app) user", async () => {
    const calls: Call[] = [];
    const me = await res(calls, ME).current();
    expect(calls[0].req.url).toContain("request_type=0");
    expect(calls[0].req.url).toContain("count=1");
    expect(me?.P_Id).toBe(9);
    expect(me?.P_Name).toBe("App User");
  });

  it("searchAll() pages by 200 until total is reached", async () => {
    const calls: Call[] = [];
    const r = createUserResource({
      requester: stub([page(3, [1, 2]), page(3, [3])], calls),
      host: "h.test",
      partition: 12,
    });
    const items = await collect(r.searchAll());
    expect(items.map((u) => u.P_Id)).toEqual([1, 2, 3]);
    expect(calls[0].req.url).toContain("count=200");
    expect(calls[1].req.url).toContain("start=2");
  });
});
