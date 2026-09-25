import { describe, expect, it } from "vitest";

import { PortersConfigError, PortersResourceError } from "../../errors";
import type { Requester } from "../../http/requester";
import type { TransportRequest } from "../../http/types";
import { createMasterReader } from "./master-read";
import type { FieldCatalog } from "./catalog";

// The master resources' own tests pin what each one sends; this pins the shared sending itself.
const FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
} as const satisfies FieldCatalog;

// The master's own query (paging aside).
type Query = { tag?: string };

const page = (total: number, ids: number[], root = "Thing"): string =>
  `<${root} Total="${total}" Count="${ids.length}" Start="0"><Code>0</Code>` +
  ids.map((id) => `<Item><T.P_Id>${id}</T.P_Id></Item>`).join("") +
  `</${root}>`;

const setup = (bodies: string[], params?: (q: Query) => URLSearchParams) => {
  const urls: string[] = [];
  const requester: Requester = {
    request: (req: TransportRequest, parse) => {
      urls.push(req.url);
      return Promise.resolve(parse(bodies.shift() ?? ""));
    },
  };
  const methods = createMasterReader(
    {
      name: "Thing",
      path: "thing",
      prefix: "T",
      fields: FIELDS,
      params:
        params ??
        ((q: Query) =>
          new URLSearchParams({ partition: "12", tag: q.tag ?? "-" })),
    },
    { requester, accessPoint: { hostname: "h.test" } },
  );
  return { methods, urls };
};

const collect = async <T>(it: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
};

describe("createMasterReader — search", () => {
  it("sends the resource's params plus count / start to its path at the access point", async () => {
    const { methods, urls } = setup([page(1, [7])]);
    const result = await methods.search({ tag: "a", count: 5, start: 10 });
    expect(urls).toEqual([
      "https://h.test/v1/thing?partition=12&tag=a&count=5&start=10",
    ]);
    expect(result.items).toEqual([{ P_Id: 7 }]);
    expect(result.total).toBe(1);
  });

  it("sends only the params when the query is omitted", async () => {
    const { methods, urls } = setup([page(0, [])]);
    await methods.search();
    expect(urls).toEqual(["https://h.test/v1/thing?partition=12&tag=-"]);
  });

  it("rejects an out-of-range count before sending (the shared count guard)", async () => {
    const { methods, urls } = setup([]);
    await expect(methods.search({ count: 201 })).rejects.toBeInstanceOf(
      PortersConfigError,
    );
    expect(urls).toEqual([]);
  });

  it("turns a failure while building params into a rejection, not a synchronous throw", async () => {
    const { methods } = setup([], () => {
      throw new PortersConfigError("bad", { category: "config" });
    });
    const call = methods.search({});
    await expect(call).rejects.toBeInstanceOf(PortersConfigError);
  });

  it("refuses a response that is not this resource's (root element check)", async () => {
    const { methods } = setup([page(1, [7], "Other")]);
    await expect(methods.search()).rejects.toBeInstanceOf(PortersResourceError);
  });
});

describe("createMasterReader — searchAll", () => {
  it("walks every page (200 at a time) until total", async () => {
    const first = Array.from({ length: 200 }, (_, i) => i + 1);
    const { methods, urls } = setup([page(201, first), page(201, [201])]);
    const all = await collect(methods.searchAll({ tag: "b" }));
    expect(all).toHaveLength(201);
    expect(urls).toEqual([
      "https://h.test/v1/thing?partition=12&tag=b&count=200&start=0",
      "https://h.test/v1/thing?partition=12&tag=b&count=200&start=200",
    ]);
  });

  it("reads the query once: changing it mid-walk does not change a later page (RV-32)", async () => {
    const first = Array.from({ length: 200 }, (_, i) => i + 1);
    const { methods, urls } = setup([page(201, first), page(201, [201])]);
    const query = { tag: "before" };
    for await (const _ of methods.searchAll(query)) query.tag = "after";
    expect(urls.every((u) => u.includes("tag=before"))).toBe(true);
  });

  it("walks with only the params when the query is omitted", async () => {
    const { methods, urls } = setup([page(0, [])]);
    expect(await collect(methods.searchAll())).toEqual([]);
    expect(urls).toEqual([
      "https://h.test/v1/thing?partition=12&tag=-&count=200&start=0",
    ]);
  });
});
