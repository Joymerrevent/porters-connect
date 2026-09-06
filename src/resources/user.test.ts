import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import { createUserResource, type UserSearchQuery } from "./user";

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
    accessPoint: { host: "h.test" },
    partition: 12,
  });

const collect = async <T>(it: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
};

describe("createUserResource", () => {
  it("search() defaults to partition + request_type=1 + user_type=-1", async () => {
    const calls: Call[] = [];
    const users = (await res(calls).search()).items;
    const url = calls[0].req.url;
    expect(url).toContain("https://h.test/v1/user?");
    expect(url).toContain("partition=12");
    expect(url).toContain("request_type=1");
    expect(url).toContain("user_type=-1");
    expect(users.map((u) => u.P_Id)).toEqual([1, 2]);
    expect(users[0].P_Type).toBe(0); // Number
    expect(users[1].P_Mail).toBe("user2@xxx.co.jp"); // Mail
  });

  it("sends the catalog default when field is omitted (ADR-0020 / ADR-0060 D2)", async () => {
    // PORTERS answers a fieldless User Read with 4 of the 17 fields, so the library asks for
    // every catalogued one — otherwise the record type promises 17 and delivers 4 (RV-1).
    const calls: Call[] = [];
    await res(calls).search();
    const field = new URL(calls[0].req.url).searchParams.get("field");
    expect(field).toBe(
      [
        "User.P_Id",
        "User.P_Type",
        "User.P_Name",
        "User.P_Mail",
        "User.P_Department",
        "User.P_Telephone",
        "User.P_Mobile",
        "User.P_MobileMail",
        "User.P_UserName",
        "User.P_TimeZone",
        "User.P_Language",
        "User.P_StartDate",
        "User.P_EndDate",
        "User.P_RegistrationDate",
        // User 型の項目だけ 4 サブ項目付きで要求する（read-core の USER_SUBFIELDS）。
        "User.P_RegisteredBy(User.P_Id,User.P_Type,User.P_Name,User.P_Mail)",
        "User.P_UpdateDate",
        "User.P_UpdatedBy(User.P_Id,User.P_Type,User.P_Name,User.P_Mail)",
      ].join(","),
    );
  });

  it("decodes the extended HR fields by their Data Type", async () => {
    const calls: Call[] = [];
    const body =
      `<?xml version="1.0"?><User Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
      `<User.P_Id>5</User.P_Id>` +
      `<User.P_Department><Department><Department.P_Id>3</Department.P_Id><Department.P_Name>営業部</Department.P_Name></Department></User.P_Department>` +
      `<User.P_Telephone>03-1234-5678</User.P_Telephone>` +
      `<User.P_TimeZone>Asia/Tokyo</User.P_TimeZone>` +
      `<User.P_StartDate>2026/04/01</User.P_StartDate>` +
      `<User.P_RegistrationDate>2026/04/01 09:30:00</User.P_RegistrationDate>` +
      `<User.P_RegisteredBy><User><User.P_Id>1</User.P_Id><User.P_Name>管理 太郎</User.P_Name></User></User.P_RegisteredBy>` +
      `<User.P_EndDate/>` +
      `</Item></User>`;
    const u = (await res(calls, body).search()).items[0];
    expect(u?.P_Department).toEqual({ P_Id: 3, P_Name: "営業部" });
    expect(u?.P_Telephone).toBe("03-1234-5678"); // Telephone は文字列のまま
    expect(u?.P_TimeZone).toBe("Asia/Tokyo");
    expect(u?.P_StartDate).toBe("2026-04-01"); // Date -> ISO
    expect(u?.P_RegistrationDate).toBe("2026-04-01T09:30:00Z"); // System[DateTime] -> ISO(UTC)
    expect(u?.P_RegisteredBy).toMatchObject({ P_Id: 1, P_Name: "管理 太郎" });
    expect(u?.P_EndDate).toBeNull(); // 空要素は null
  });

  it("passes userType / field / count / start through", async () => {
    const calls: Call[] = [];
    await res(calls).search({
      requestType: 1,
      userType: 0,
      // Bare alias in, `User.` prefix added by the library (ADR-0059).
      field: ["P_Name"],
      count: 5,
      start: 2,
    });
    const url = decodeURIComponent(calls[0].req.url);
    expect(url).toContain("user_type=0");
    expect(url).toContain("field=User.P_Name");
    expect(url).toContain("count=5");
    expect(url).toContain("start=2");
  });

  it("treats an empty field array as PORTERS' own default (no field param)", async () => {
    // `[]` は「API ネイティブの答えに委ねる」＝ PORTERS 既定の 4 項目（他リソースの `[]` と同じ位置づけ）。
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
      accessPoint: { host: "h.test" },
      partition: 12,
    });
    const items = await collect(r.searchAll());
    expect(items.map((u) => u.P_Id)).toEqual([1, 2, 3]);
    expect(calls[0].req.url).toContain("count=200");
    expect(calls[1].req.url).toContain("start=2");
  });

  it("walks the query as handed over: mutating it mid-iteration cannot change a later page (RV-32)", async () => {
    const calls: Call[] = [];
    const r = createUserResource({
      requester: stub([page(3, [1, 2]), page(3, [3])], calls),
      accessPoint: { host: "h.test" },
      partition: 12,
    });
    const query: Omit<UserSearchQuery, "count" | "start"> = {
      userType: 1,
      field: ["P_Name", "P_Type"],
    };
    for await (const item of r.searchAll(query)) {
      expect(item.P_Id).toBeGreaterThan(0);
      query.userType = 0;
      query.field?.push("P_Id"); // 入れ子（配列）だけの書き換えも効かない
    }
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      const url = new URL(c.req.url);
      expect(url.pathname).toBe("/v1/user"); // ページごとの URL でも宛先は同じ
      const p = url.searchParams;
      expect(p.get("user_type")).toBe("1");
      expect(p.get("field")).toBe("User.P_Name,User.P_Type");
    }
  });
});
