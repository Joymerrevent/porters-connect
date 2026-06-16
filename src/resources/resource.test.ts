import { describe, expect, it } from "vitest";

import { PortersResourceError } from "../errors";
import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { DataType } from "../xml/decode";
import { createResource, type ResourceConfig } from "./resource";

// A synthetic resource exercises the factory in isolation (the concrete catalogs
// live in candidate/job tests). One field per Data Type is enough — per-type
// decoding is covered by decode.test.ts; here we test the wiring.
const FIELDS = new Map<string, DataType>([
  ["P_Id", "System[Id]"],
  ["P_Owner", "User"],
  ["P_When", "DateTime"],
  ["P_Phase", "Option"],
  ["P_Name", "SinglelineText"],
]);

const CONFIG: ResourceConfig = {
  name: "Widget",
  path: "widget",
  prefix: "W",
  fields: FIELDS,
};

// A prefixed key (`W.P_Id`) exercises bareAlias; an unknown alias passes through.
const OK = `<?xml version="1.0"?><Widget Total="1" Count="1" Start="0"><Code>0</Code><Item><W.P_Id>7</W.P_Id><W.U_x>raw</W.U_x></Item></Widget>`;

const page = (total: number, ids: number[]): string =>
  `<Widget Total="${total}" Count="${ids.length}" Start="0"><Code>0</Code>` +
  ids.map((id) => `<Item><W.P_Id>${id}</W.P_Id></Item>`).join("") +
  `</Widget>`;

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
  createResource(CONFIG, {
    requester: stub(bodies.length > 0 ? bodies : [OK], calls),
    host: "h.test",
    partition: 12,
  });

const collect = async <T>(it: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
};

describe("createResource — Read", () => {
  it("builds the read URL with partition / field / condition / count / start", async () => {
    const calls: Call[] = [];
    await res(calls).search({
      field: ["P_Id", "P_Name"],
      condition: { "W.P_Id:eq": "1" },
      count: 50,
      start: 100,
    });
    const url = calls[0].req.url;
    expect(calls[0].req.method).toBe("GET");
    expect(url).toContain("https://h.test/v1/widget?");
    expect(url).toContain("partition=12");
    expect(url).toContain("field=P_Id%2CP_Name");
    expect(decodeURIComponent(url)).toContain("condition=W.P_Id:eq=1");
    expect(url).toContain("count=50");
    expect(url).toContain("start=100");
  });

  it("joins multiple conditions with a comma", async () => {
    const calls: Call[] = [];
    await res(calls).search({
      condition: { "W.P_Id:eq": "1", "W.P_Name:part": "x" },
    });
    expect(decodeURIComponent(calls[0].req.url)).toContain(
      "condition=W.P_Id:eq=1,W.P_Name:part=x",
    );
  });

  it("omits empty condition / field and undefined count / start", async () => {
    const calls: Call[] = [];
    await res(calls).search({ condition: {}, field: [] });
    const url = calls[0].req.url;
    expect(url).not.toContain("condition=");
    expect(url).not.toContain("field=");
    expect(url).not.toContain("count=");
    expect(url).not.toContain("start=");
  });

  it("decodes known fields (with bareAlias) and passes unknown aliases through", async () => {
    const calls: Call[] = [];
    const item = (await res(calls).search()).items[0];
    expect(item.P_Id).toBe(7); // Id -> number, via bareAlias on "W.P_Id" + catalog
    expect(item.U_x).toBe("raw"); // unknown alias -> raw string
  });

  it("decodes a nested (non-string) unknown alias as null", async () => {
    const body = `<Widget Total="1" Count="1" Start="0"><Code>0</Code><Item><W.U_obj><n>1</n></W.U_obj></Item></Widget>`;
    const calls: Call[] = [];
    const item = (await res(calls, body).search()).items[0];
    expect(item.U_obj).toBeNull();
  });

  it("reads Total / Count / Start from the page", async () => {
    const calls: Call[] = [];
    const result = await res(calls, page(9, [1, 2])).search();
    expect(result.total).toBe(9);
    expect(result.count).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it("get(id) sends a {prefix}.P_Id condition (count=1) and returns the first item", async () => {
    const calls: Call[] = [];
    const item = await res(calls).get(7);
    expect(item?.P_Id).toBe(7);
    expect(calls[0].req.url).toContain("count=1");
    expect(decodeURIComponent(calls[0].req.url)).toContain("W.P_Id:eq=7");
  });
});

describe("createResource — searchAll", () => {
  it("pages through all results (200/page) until total is reached", async () => {
    const calls: Call[] = [];
    const r = createResource(CONFIG, {
      requester: stub([page(3, [1, 2]), page(3, [3])], calls),
      host: "h.test",
      partition: 12,
    });
    const items = await collect(
      r.searchAll({ condition: { "W.P_Name:part": "x" } }),
    );
    expect(items.map((c) => c.P_Id)).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(2);
    expect(calls[0].req.url).toContain("count=200");
    expect(calls[0].req.url).toContain("start=0");
    expect(calls[1].req.url).toContain("start=2"); // advanced by items received
  });

  it("makes a single request when the first page reaches total", async () => {
    const calls: Call[] = [];
    const r = createResource(CONFIG, {
      requester: stub([page(2, [1, 2]), page(2, [])], calls),
      host: "h.test",
      partition: 12,
    });
    const items = await collect(r.searchAll());
    expect(items.map((c) => c.P_Id)).toEqual([1, 2]);
    expect(calls).toHaveLength(1); // 2 >= total(2) -> done after one page
  });

  it("stops on an empty page even if total claims more (no infinite loop)", async () => {
    const calls: Call[] = [];
    const r = createResource(CONFIG, {
      requester: stub([page(5, []), page(5, [])], calls),
      host: "h.test",
      partition: 12,
    });
    const items = await collect(r.searchAll());
    expect(items).toEqual([]);
    expect(calls).toHaveLength(1); // empty page halts the walk defensively
  });
});

describe("createResource — Write", () => {
  it("create POSTs to {path}, forces P_Id=-1, is non-idempotent, returns the id", async () => {
    const calls: Call[] = [];
    const id = await res(calls, WRITE_OK()).create({ P_Name: "hi" });
    expect(id).toBe(100);
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/widget?partition=12");
    expect(req.body).toBe(
      "<Widget><Item><W.P_Name>hi</W.P_Name><W.P_Id>-1</W.P_Id></Item></Widget>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("update forces the target id and is idempotent", async () => {
    const calls: Call[] = [];
    const id = await res(calls, WRITE_OK(7)).update(7, { P_Name: "x" });
    expect(id).toBe(7);
    expect(calls[0].req.body).toContain("<W.P_Id>7</W.P_Id>");
    expect(calls[0].spec).toEqual({ write: true, idempotent: true });
  });

  it("maps a non-zero per-Item Code to a PortersResourceError", async () => {
    const calls: Call[] = [];
    const body = `<Widget><Item><Id>0</Id><Code>403</Code></Item></Widget>`;
    let err: unknown;
    try {
      await res(calls, body).create({ P_Name: "x" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).code).toBe(403);
    expect((err as PortersResourceError).category).toBe("permission");
    expect((err as PortersResourceError).message).toBe(
      "widget write returned code 403",
    );
    expect((err as PortersResourceError).context?.resource).toBe("Widget");
  });

  it("throws when the Write response carries no result Item", async () => {
    const calls: Call[] = [];
    const body = `<Widget><Other>x</Other></Widget>`;
    let err: unknown;
    try {
      await res(calls, body).create({ P_Name: "x" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).category).toBe("unknown");
    expect((err as PortersResourceError).message).toBe(
      "write returned no result item",
    );
  });
});
