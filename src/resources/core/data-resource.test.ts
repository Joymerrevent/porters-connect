import { describe, expect, expectTypeOf, it } from "vitest";

import type { Requester, RequestSpec } from "../../http/requester";
import type { TransportRequest } from "../../http/types";
import { createDataResource, type DataResource } from "./data-resource";
import type { Paging } from "./paging";
import type { FieldCatalog } from "./catalog";
import type { SearchQuery } from "./query";
import type { ResourceDescriptor } from "./descriptor";

// A synthetic resource exercises the factory in isolation (the concrete catalogs
// live in candidate/job tests). One field per Data Type is enough — per-type
// decoding is covered by decode.test.ts; here we test the wiring. No required-on-create
// fields, so Write input is all-optional.
const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_When: "DateTime",
  P_Phase: "Option",
  P_Name: "SinglelineText",
  // PORTERS が Data Type を与えていない項目（ADR-0056）。Read の field には出るが
  // condition / order / Write には出ない — 導出型がそれを自動で満たす。
  P_Deleted: null,
} as const satisfies FieldCatalog;

const CONFIG = {
  name: "Widget",
  path: "widget",
  prefix: "W",
  fields: FIELDS,
  requiredOnCreate: [],
} as const;

// A prefixed key (`W.P_Id`) exercises bareAlias; an unknown alias passes through.
const OK = `<?xml version="1.0"?><Widget Total="1" Count="1" Start="0"><Code>0</Code><Item><W.P_Id>7</W.P_Id><W.U_x>raw</W.U_x></Item></Widget>`;

const WRITE_OK = (id = 100) =>
  `<Widget><Item><Id>${id}</Id><Code>0</Code></Item></Widget>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (bodies: string[], calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(bodies.shift() ?? ""));
  },
});

const res = (calls: Call[], ...bodies: string[]) =>
  createDataResource(CONFIG, {
    requester: stub(bodies.length > 0 ? bodies : [OK], calls),
    accessPoint: { hostname: "h.test" },
    partition: 12,
  });

// 読み込み（data-read.ts）と書き込み（data-write.ts）の中身はそれぞれのテストで確かめる。ここでは 2 つを
// 1 つのアクセサにまとめること（同じ設定で両方が動くこと）と、公開の形（DataResource）の型を確かめる。
describe("createDataResource — 読み込みと書き込みをまとめる", () => {
  it("8 つのメソッドを持つ", () => {
    expect(Object.keys(res([])).sort()).toEqual([
      "create",
      "createMany",
      "get",
      "getMany",
      "search",
      "searchAll",
      "update",
      "updateMany",
    ]);
  });

  it("同じ設定と接続で、読み込みも書き込みも同じリソースに送る", async () => {
    const calls: Call[] = [];
    const r = res(calls, OK, WRITE_OK());
    await r.search();
    await r.create({});
    expect(calls[0]?.req.url).toContain("/widget?partition=12");
    expect(calls[1]?.req.url).toContain("/widget?partition=12");
    expect(calls[1]?.req.body).toContain("<Widget>");
  });
});

describe("createDataResource — クエリとページ送りは別の型（ADR-0099）", () => {
  it("SearchQuery holds what to look for only; paging is Paging", () => {
    expectTypeOf<SearchQuery<typeof FIELDS>>().not.toHaveProperty("count");
    expectTypeOf<SearchQuery<typeof FIELDS>>().not.toHaveProperty("start");
    const q: SearchQuery<typeof FIELDS> & Paging = {
      field: ["P_Name"],
      count: 5,
      start: 10,
    };
    expect(q.count).toBe(5);
  });

  it("search takes paging; searchAll does not (it walks the pages itself)", async () => {
    const calls: Call[] = [];
    await res(calls).search({ field: ["P_Name"], count: 5, start: 10 });
    expect(calls[0].req.url).toContain("count=5&start=10");
    const typeOnly = (r: ReturnType<typeof res>) => {
      // @ts-expect-error — searchAll decides count / start itself
      void r.searchAll({ count: 5 });
    };
    expect(typeOnly).toBeTypeOf("function");
  });
});

// 型のテストだけで使う、参照先を持つリソース（中身は data-read.test.ts の fixture と同じ）。`_` は
// 型の元にするだけで、値としては読まないことを示す。
const PART_FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
  P_Made: "Date",
} as const satisfies FieldCatalog;

const _PART_DESCRIPTOR = {
  name: "Part",
  path: "part",
  prefix: "Pt",
  fields: PART_FIELDS,
} as const satisfies ResourceDescriptor;

const _GADGET_FIELDS = {
  P_Id: "System[Id]",
  P_Part: "System[Reference]",
  P_Vendor: "System[Reference]", // no target registered: reads as the referenced id
  P_Name: "SinglelineText",
} as const satisfies FieldCatalog;

describe("createDataResource — 戻り値の型は要求した項目に絞る（ADR-0096）", () => {
  // Types only: each case is a function the compiler checks and the test never calls.
  type R = ReturnType<typeof res>;
  type G = DataResource<
    typeof _GADGET_FIELDS,
    never,
    { P_Part: typeof _PART_DESCRIPTOR }
  >;
  type A = DataResource<
    {
      P_Id: "System[Id]";
      P_Name: "SinglelineText";
      U_photo: "Image";
      U_link: "Link";
    },
    never
  >;

  it("a literal field list keeps just those keys (still optional)", () => {
    const typeOnly = async (r: R) => {
      const page = await r.search({ field: ["P_Name"] });
      expectTypeOf<
        keyof (typeof page.items)[number]
      >().toEqualTypeOf<"P_Name">();
      const name: string | null | undefined = page.items[0]?.P_Name;
      void name;
      // @ts-expect-error — P_Owner was not requested
      void page.items[0]?.P_Owner;
    };
    expect(typeOnly).toBeTypeOf("function");
  });

  it("omitting field keeps every known field, and so does a list the compiler cannot see", () => {
    const typeOnly = async (r: R, list: (keyof typeof FIELDS)[]) => {
      const all = await r.search();
      void all.items[0]?.P_Owner;
      void all.items[0]?.P_Deleted;
      for await (const x of r.searchAll({ field: list })) void x.P_When;
    };
    expect(typeOnly).toBeTypeOf("function");
  });

  it("expand / image keys are requested too, even when field leaves them out", () => {
    const typeOnly = async (g: G, a: A) => {
      const page = await g.search({
        field: ["P_Name"],
        expand: { P_Part: ["P_Name"] },
      });
      void page.items[0]?.P_Part?.P_Name;
      const photos = await a.search({
        field: ["P_Name"],
        image: { U_photo: ["FileName"] },
      });
      void photos.items[0]?.U_photo?.FileName;
    };
    expect(typeOnly).toBeTypeOf("function");
  });

  it("field: [] keeps nothing on search (expand is not sent then)", () => {
    const typeOnly = async (g: G) => {
      const page = await g.search({
        field: [],
        expand: { P_Part: ["P_Name"] },
      });
      expectTypeOf<keyof (typeof page.items)[number]>().toEqualTypeOf<never>();
      expect(page.items).toBeDefined();
    };
    expect(typeOnly).toBeTypeOf("function");
  });

  it("get / getMany always keep the id, and expand with field: [] (the id keeps field non-empty)", () => {
    const typeOnly = async (r: R, g: G) => {
      const one = await r.get(1, { field: ["P_Name"] });
      void one?.P_Id;
      void one?.P_Name;
      // @ts-expect-error — P_Owner was not requested
      void one?.P_Owner;
      const ids = await g.getMany([1], {
        field: [],
        expand: { P_Part: ["P_Name"] },
      });
      void ids[0]?.P_Id;
      void ids[0]?.P_Part;
      // @ts-expect-error — P_Name was not requested
      void ids[0]?.P_Name;
    };
    expect(typeOnly).toBeTypeOf("function");
  });
});
