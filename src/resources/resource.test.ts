import { describe, expect, it } from "vitest";

import { PortersConfigError, PortersResourceError } from "../errors";
import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { FieldValue } from "../xml/decode";
import {
  createResource,
  type Expand,
  type FieldCatalog,
  type ResourceDescriptor,
  type SearchQuery,
} from "./resource";

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
    accessPoint: { host: "h.test" },
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
      condition: { P_Id: { eq: 1 } },
      count: 50,
      start: 100,
    });
    const url = calls[0].req.url;
    expect(calls[0].req.method).toBe("GET");
    expect(url).toContain("https://h.test/v1/widget?");
    expect(url).toContain("partition=12");
    expect(url).toContain("field=W.P_Id%2CW.P_Name");
    expect(decodeURIComponent(url)).toContain("condition=W.P_Id:eq=1");
    expect(url).toContain("count=50");
    expect(url).toContain("start=100");
  });

  it("joins multiple conditions with a comma (each prefixed, by Data Type)", async () => {
    const calls: Call[] = [];
    await res(calls).search({
      condition: { P_Id: { eq: 1 }, P_Name: { part: "x" } },
    });
    expect(decodeURIComponent(calls[0].req.url)).toContain(
      "condition=W.P_Id:eq=1,W.P_Name:part=x",
    );
  });

  it("wires order / keywords / itemstate through search()", async () => {
    const calls: Call[] = [];
    await res(calls).search({
      condition: { P_Id: { eq: 7 } },
      order: [{ P_When: "desc" }],
      keywords: ["alpha", "beta"],
      itemstate: "deleted",
    });
    const url = decodeURIComponent(calls[0].req.url);
    expect(url).toContain("condition=W.P_Id:eq=7");
    expect(url).toContain("order=W.P_When:desc");
    expect(url).toContain("keywords=alpha,beta");
    expect(url).toContain("itemstate=deleted");
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
    // Custom `U_` aliases aren't on the closed ReadRecord (U1); read them via a loose view.
    const rec = item as Record<string, FieldValue | undefined>;
    expect(item.P_Id).toBe(7); // Id -> number, via bareAlias on "W.P_Id" + catalog
    expect(rec.U_x).toBe("raw"); // unknown alias -> raw string
  });

  it("decodes a nested (non-string) unknown alias as null", async () => {
    const body = `<Widget Total="1" Count="1" Start="0"><Code>0</Code><Item><W.U_obj><n>1</n></W.U_obj></Item></Widget>`;
    const calls: Call[] = [];
    const item = (await res(calls, body).search()).items[0];
    expect((item as Record<string, FieldValue | undefined>).U_obj).toBeNull();
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

describe("createResource — default field (ADR-0020)", () => {
  // The default field set the factory derives from CONFIG's catalog: every alias prefixed,
  // the User field expanded to its 4 readable sub-fields, the rest plain — including the
  // Data-Type-less `P_Deleted`, which is a Read-`field` field like any other (ADR-0056).
  const DEFAULT_FIELD =
    "field=W.P_Id,W.P_Owner(User.P_Id,User.P_Type,User.P_Name,User.P_Mail),W.P_When,W.P_Phase,W.P_Name,W.P_Deleted";

  it("search() with no field sends the catalog default (User expanded)", async () => {
    const calls: Call[] = [];
    await res(calls).search();
    expect(decodeURIComponent(calls[0].req.url)).toContain(DEFAULT_FIELD);
  });

  it("field: [] opts into the API-native primary-key-only response (no field param)", async () => {
    const calls: Call[] = [];
    await res(calls).search({ field: [] });
    expect(calls[0].req.url).not.toContain("field=");
  });

  it("a provided field list is prefixed, and no default is injected", async () => {
    const calls: Call[] = [];
    await res(calls).search({ field: ["P_Name"] });
    const url = decodeURIComponent(calls[0].req.url);
    expect(url).toContain("field=W.P_Name");
    expect(url).not.toContain("W.P_Owner"); // default not mixed in
  });

  it("get(id) sends the default field set so it returns a full record, not just P_Id", async () => {
    const calls: Call[] = [];
    await res(calls).get(7);
    expect(decodeURIComponent(calls[0].req.url)).toContain(DEFAULT_FIELD);
  });
});

describe("createResource — bare field aliases (ADR-0059)", () => {
  const fieldParam = async (
    field: SearchQuery<typeof FIELDS>["field"],
  ): Promise<string> => {
    const calls: Call[] = [];
    await res(calls).search({ field });
    return (
      decodeURIComponent(calls[0].req.url).match(/field=([^&]*)/)?.[1] ?? ""
    );
  };

  it("prefixes a caller's bare aliases with the resource prefix", async () => {
    expect(await fieldParam(["P_Id", "P_Name"])).toBe("W.P_Id,W.P_Name");
  });

  it("expands a User-typed alias like the default list does", async () => {
    // Without `()` PORTERS returns an id, but the typed record promises a UserRef — so an
    // explicitly requested User field is assembled exactly as the default one is.
    expect(await fieldParam(["P_Owner"])).toBe(
      "W.P_Owner(User.P_Id,User.P_Type,User.P_Name,User.P_Mail)",
    );
  });

  it("passes an undeclared custom U_/A_ alias through, prefixed", async () => {
    expect(await fieldParam(["U_memo", "A_flag"])).toBe("W.U_memo,W.A_flag");
  });

  it("strips a prefix that arrived through a cast instead of doubling it", async () => {
    // The types say bare; the runtime still understands the old prefixed form (ADR-0059) —
    // mirroring `bareAlias` on the response side, so a cast never sends `W.W.P_Name`.
    const cast = ["W.P_Name"] as unknown as SearchQuery<typeof FIELDS>["field"];
    expect(await fieldParam(cast)).toBe("W.P_Name");
  });

  it("corrects a wrong prefix rather than sending it (the Candidate `Person.` trap)", async () => {
    const cast = ["Widget.P_Name"] as unknown as SearchQuery<
      typeof FIELDS
    >["field"];
    expect(await fieldParam(cast)).toBe("W.P_Name");
  });
});

// A resource with an expandable reference: `P_Part` points at PART, whose alias prefix (`Pt`)
// differs from its name — the Candidate `Person` case that makes carrying the prefix worthwhile.
const PART_FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
  P_Made: "Date",
} as const satisfies FieldCatalog;

const PART_DESCRIPTOR = {
  name: "Part",
  path: "part",
  prefix: "Pt",
  fields: PART_FIELDS,
} as const satisfies ResourceDescriptor;

const GADGET_FIELDS = {
  P_Id: "System[Id]",
  P_Part: "System[Reference]",
  P_Vendor: "System[Reference]", // no target registered: reads as the referenced id
  P_Name: "SinglelineText",
} as const satisfies FieldCatalog;

const GADGET_CONFIG = {
  name: "Gadget",
  path: "gadget",
  prefix: "G",
  fields: GADGET_FIELDS,
  references: { P_Part: PART_DESCRIPTOR },
  requiredOnCreate: [],
} as const;

// One Gadget whose P_Part came back expanded (the wrapper tag is the referenced resource).
const EXPANDED = `<Gadget Total="1" Count="1" Start="0"><Code>0</Code><Item><G.P_Id>1</G.P_Id><G.P_Part><Part><Pt.P_Id>77</Pt.P_Id><Pt.P_Name>bolt</Pt.P_Name><Pt.P_Made>2026/01/02</Pt.P_Made></Part></G.P_Part></Item></Gadget>`;

const gadget = (calls: Call[], ...bodies: string[]) =>
  createResource(GADGET_CONFIG, {
    requester: stub(bodies.length > 0 ? bodies : [EXPANDED], calls),
    accessPoint: { host: "h.test" },
    partition: 12,
  });

const fieldOf = (calls: Call[]): string =>
  decodeURIComponent(calls[0].req.url).match(/field=([^&]*)/)?.[1] ?? "";

describe("createResource — expand (ADR-0058)", () => {
  it("sends the expansion as one field entry, prefixed with the *referenced* resource", async () => {
    const calls: Call[] = [];
    await gadget(calls).search({
      field: ["P_Id", "P_Part"],
      expand: { P_Part: ["P_Id", "P_Name"] },
    });
    expect(fieldOf(calls)).toBe("G.P_Id,G.P_Part(Pt.P_Id,Pt.P_Name)");
  });

  it("replaces the plain entry in place — the same alias is never sent twice", async () => {
    const calls: Call[] = [];
    // `field` omitted -> the catalog default, which already contains the plain `G.P_Part`.
    await gadget(calls).search({ expand: { P_Part: ["P_Id"] } });
    const field = fieldOf(calls);
    expect(field).toBe("G.P_Id,G.P_Part(Pt.P_Id),G.P_Vendor,G.P_Name");
    expect(field).not.toContain("G.P_Part,"); // no un-expanded duplicate
  });

  it("appends the entry when the caller's own field list left the alias out", async () => {
    const calls: Call[] = [];
    await gadget(calls).search({
      field: ["P_Id"],
      expand: { P_Part: ["P_Id"] },
    });
    expect(fieldOf(calls)).toBe("G.P_Id,G.P_Part(Pt.P_Id)");
  });

  it("decodes the nested record by the *referenced* resource's Data Types", async () => {
    const page = await gadget([]).search({
      expand: { P_Part: ["P_Id", "P_Name", "P_Made"] },
    });
    expect(page.items[0]?.P_Part).toEqual({
      P_Id: 77, // System[Id] -> number
      P_Name: "bolt", // SinglelineText -> string
      P_Made: "2026-01-02", // Date -> ISO, per the referenced catalog (not Gadget's)
    });
  });

  it("leaves an un-expanded reference as the referenced id", async () => {
    const body = `<Gadget Total="1" Count="1" Start="0"><Code>0</Code><Item><G.P_Part><Part><Pt.P_Id>77</Pt.P_Id></Part></G.P_Part></Item></Gadget>`;
    const page = await gadget([], body).search();
    expect(page.items[0]?.P_Part).toBe(77);
  });

  it("ignores an empty selection: nothing to select is the ID-only form we already send", async () => {
    const calls: Call[] = [];
    await gadget(calls).search({
      field: ["P_Id", "P_Part"],
      expand: { P_Part: [] },
    });
    expect(fieldOf(calls)).toBe("G.P_Id,G.P_Part");
  });

  it("ignores a reference with no registered target (Recruiter's case)", async () => {
    const calls: Call[] = [];
    // Not writable through the type — that is the point: an unregistered target cannot be asked
    // for. The runtime still has to cope, since a cast can reach it.
    const cast = { P_Vendor: ["P_Id"] } as unknown as Expand<
      (typeof GADGET_CONFIG)["references"]
    >;
    await gadget(calls).search({ field: ["P_Id", "P_Vendor"], expand: cast });
    expect(fieldOf(calls)).toBe("G.P_Id,G.P_Vendor");
  });

  it("get(id) expands too", async () => {
    const calls: Call[] = [];
    // PORTERS returns only what was selected, so the body carries just the narrowed field.
    const narrowed = `<Gadget Total="1" Count="1" Start="0"><Code>0</Code><Item><G.P_Part><Part><Pt.P_Name>bolt</Pt.P_Name></Part></G.P_Part></Item></Gadget>`;
    const one = await gadget(calls, narrowed).get(1, {
      expand: { P_Part: ["P_Name"] },
    });
    expect(fieldOf(calls)).toContain("G.P_Part(Pt.P_Name)");
    expect(one?.P_Part).toEqual({ P_Name: "bolt" });
  });

  it("searchAll expands on every page", async () => {
    const calls: Call[] = [];
    const items = await collect(
      gadget(calls).searchAll({ expand: { P_Part: ["P_Name"] } }),
    );
    expect(fieldOf(calls)).toContain("G.P_Part(Pt.P_Name)");
    expect(items[0]?.P_Part).toHaveProperty("P_Name", "bolt");
  });
});

describe("createResource — raw field expansions are rejected (ADR-0058)", () => {
  // `field` only accepts bare aliases (ADR-0059), so this needs a cast — the guard is the layer
  // underneath that type. Without it the request would go out and the nested answer be discarded.
  const raw = <T>(entry: string): T => [entry] as unknown as T;

  it("rejects an expansion written into field, pointing at expand", async () => {
    const calls: Call[] = [];
    await expect(
      gadget(calls).search({ field: raw("G.P_Part(Pt.P_Id)") }),
    ).rejects.toMatchObject({
      name: "PortersConfigError",
      category: "config",
    });
    expect(calls).toHaveLength(0); // never sent
  });

  it("names expand in the hint", async () => {
    const error: unknown = await gadget([])
      .search({ field: raw("G.P_Part(Pt.P_Id)") })
      .catch((e: unknown) => e);
    expect((error as PortersConfigError).hint).toContain("expand: { P_Part:");
  });

  it("rejects rather than throwing synchronously (ADR-0046)", async () => {
    let promise: Promise<unknown> | undefined;
    expect(() => {
      promise = gadget([]).search({ field: raw("G.P_Part(Pt.P_Id)") });
    }).not.toThrow();
    await expect(promise).rejects.toBeInstanceOf(PortersConfigError);
  });

  it("leaves the library's own User expansion and uncatalogued aliases alone", async () => {
    // A User field's `()` is what the library itself emits, and an alias outside the catalog
    // (an Image custom field's `(FileName,…)`) is not ours to judge — both pass through.
    const user: Call[] = [];
    await res(user).search({ field: raw("W.P_Owner(User.P_Id)") });
    expect(user).toHaveLength(1);
    const custom: Call[] = [];
    await res(custom).search({ field: raw("W.U_photo(FileName,ContentType)") });
    expect(custom).toHaveLength(1);
  });
});

describe("createResource — searchAll", () => {
  it("pages through all results (200/page) until total is reached", async () => {
    const calls: Call[] = [];
    const r = createResource(CONFIG, {
      requester: stub([page(3, [1, 2]), page(3, [3])], calls),
      accessPoint: { host: "h.test" },
      partition: 12,
    });
    const items = await collect(
      r.searchAll({ condition: { P_Name: { part: "x" } } }),
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
      accessPoint: { host: "h.test" },
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
      accessPoint: { host: "h.test" },
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
