// Generic resource accessor (ADR-0004/0005/0011): the Read (search / searchAll /
// get) + Write (create / update) shape shared by every PORTERS resource. A resource
// module supplies its names + Data-Type catalog; this owns the wiring and keeps XML
// out of resources/ (parse/encode live in xml/). Standard `P_` fields use the catalog;
// custom `U_`/`A_` pass through (decode: raw string / encode: Text).

import { PortersResourceError, resourceError } from "../errors";
import type { Requester } from "../http/requester";
import {
  decodeField,
  type DataType,
  type DecodedValue,
  type FieldValue,
} from "../xml/decode";
import {
  buildWriteXml,
  type WritableDataType,
  type WriteItem,
  type WriteValueOf,
} from "../xml/encode";
import { parseResourcePage, parseWriteResult } from "../xml/parser";

// A field catalog: bare alias -> Data Type. Declared `as const` per resource so the static
// Read/Write types derive from it — the catalog is the single source of truth (ADR-0019).
export type FieldCatalog = Record<string, DataType>;

/**
 * A decoded record: every known field, each `DecodedValue | null`, and **optional** because a
 * field not named in `field` is simply absent (SD-3 "simple" type — ADR-0005/0019). Custom
 * `U_`/`A_` aliases are not in the catalog, so they are not typed here (access via a cast until
 * the declaration DSL lands — ADR-0005 SD-2); at runtime they still pass through as raw values.
 */
export type ReadRecord<F extends FieldCatalog> = {
  [K in keyof F]?: DecodedValue<F[K]> | null;
};

export type ResourcePage<F extends FieldCatalog> = {
  items: ReadRecord<F>[];
  total: number;
  count: number;
  start: number;
};

export type SearchQuery = {
  field?: string[];
  condition?: Record<string, string>;
  count?: number;
  start?: number;
};

// Writable aliases: every field whose Data Type a user may write (excludes System[Id] /
// System[DateTime] — ADR-0016/0019).
type WritableKeys<F extends FieldCatalog> = {
  [K in keyof F]: F[K] extends WritableDataType ? K : never;
}[keyof F];

/**
 * Create input (ADR-0019 W2): the `requiredOnCreate` aliases are **required** (non-null); every
 * other writable field is optional (`null` omits). `P_Id` is supplied by the library — not here.
 */
export type CreateInput<F extends FieldCatalog, Req extends keyof F> = {
  [K in Req]: WriteValueOf<F[K]>;
} & {
  [K in Exclude<WritableKeys<F>, Req>]?: WriteValueOf<F[K]> | null;
};

/** Update input (ADR-0019 W2): every writable field optional (`null` omits, `""` clears). */
export type UpdateInput<F extends FieldCatalog> = {
  [K in WritableKeys<F>]?: WriteValueOf<F[K]> | null;
};

/** Static description of a resource: names + `as const` catalog + required-on-create aliases. */
export type ResourceConfig<
  F extends FieldCatalog,
  Req extends readonly (keyof F)[],
> = {
  /** Root element + Write resource name, e.g. `"Candidate"`. */
  name: string;
  /** URL path segment, e.g. `"candidate"`. */
  path: string;
  /** Field alias prefix, e.g. `"Person"`. */
  prefix: string;
  /** Data-Type catalog (`as const`): bare alias -> Data Type. */
  fields: F;
  /** Aliases required on `create` (PORTERS new-record requirements — ADR-0019 W2). */
  requiredOnCreate: Req;
};

export type Resource<F extends FieldCatalog, Req extends keyof F> = {
  search(query?: SearchQuery): Promise<ResourcePage<F>>;
  /** Auto-paginating search: yields every matching record (200 per page). */
  searchAll(
    query?: Omit<SearchQuery, "count" | "start">,
  ): AsyncIterable<ReadRecord<F>>;
  get(id: number): Promise<ReadRecord<F> | undefined>;
  /** Create one record; resolves to the newly assigned id. */
  create(input: CreateInput<F, Req>): Promise<number>;
  /** Update one record by id; resolves to that id. */
  update(id: number, input: UpdateInput<F>): Promise<number>;
};

// Read max page size (docs/reference: count 1–200). searchAll pages by this.
const PAGE_SIZE = 200;

// `includes(".")` -> `includes("")` is an equivalent mutant: for a dotless key,
// slice(indexOf(".") + 1) is slice(0), which equals the key — same as the else.
// Stryker disable StringLiteral
const bareAlias = (key: string): string =>
  key.includes(".") ? key.slice(key.indexOf(".") + 1) : key;
// Stryker restore StringLiteral

/**
 * A single-Item Write response -> the assigned/updated id. A non-zero per-item Code is a
 * resource error (mapped, not swallowed); a missing result Item is unparseable. Shared by
 * the generic factory and the bespoke Attachment accessor. `path` names the error code
 * message, `name` the error context resource.
 */
export const firstWriteResultId = (
  body: string,
  path: string,
  name: string,
): number => {
  const first = parseWriteResult(body)[0];
  if (first === undefined) {
    throw new PortersResourceError("write returned no result item", {
      category: "unknown",
    });
  }
  if (first.code !== 0) {
    throw resourceError(
      first.code,
      `${path} write returned code ${first.code}`,
      {
        resource: name,
      },
    );
  }
  return first.id;
};

/** Build a Read URL: `https://{host}/v1/{path}?partition=…&field=…&condition=…&count=…&start=…`. */
export const buildReadUrl = (
  host: string,
  partition: number,
  path: string,
  q: SearchQuery,
): string => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  if (q.field && q.field.length > 0) p.set("field", q.field.join(","));
  if (q.condition) {
    const conds = Object.entries(q.condition).map(([k, v]) => `${k}=${v}`);
    if (conds.length > 0) p.set("condition", conds.join(","));
  }
  if (q.count !== undefined) p.set("count", String(q.count));
  if (q.start !== undefined) p.set("start", String(q.start));
  return `https://${host}/v1/${path}?${p.toString()}`;
};

/** Build a Write URL: `https://{host}/v1/{path}?partition=…`. */
export const buildWriteUrl = (
  host: string,
  partition: number,
  path: string,
): string => `https://${host}/v1/${path}?partition=${partition}`;

export const createResource = <
  const F extends FieldCatalog,
  const Req extends readonly (keyof F)[],
>(
  config: ResourceConfig<F, Req>,
  deps: { requester: Requester; host: string; partition: number },
): Resource<F, Req[number]> => {
  // The catalog is `as const` for the types; decode/encode need a runtime lookup.
  const fieldMap = new Map<string, DataType>(Object.entries(config.fields));
  const decodeItem = (item: Record<string, unknown>): ReadRecord<F> => {
    const out: Record<string, FieldValue> = {};
    for (const [key, raw] of Object.entries(item)) {
      const alias = bareAlias(key);
      const type = fieldMap.get(alias);
      out[alias] = type
        ? decodeField(type, raw)
        : typeof raw === "string"
          ? raw
          : null;
    }
    return out as ReadRecord<F>;
  };

  const readUrl = (q: SearchQuery): string =>
    buildReadUrl(deps.host, deps.partition, config.path, q);

  const writeUrl = (): string =>
    buildWriteUrl(deps.host, deps.partition, config.path);

  const firstWriteId = (body: string): number =>
    firstWriteResultId(body, config.path, config.name);

  const search = (query: SearchQuery = {}): Promise<ResourcePage<F>> =>
    deps.requester.request(
      { method: "GET", url: readUrl(query), headers: {} },
      (body) => {
        const page = parseResourcePage(body);
        return {
          items: page.items.map(decodeItem),
          total: page.total,
          count: page.count,
          start: page.start,
        };
      },
    );

  // A generator can't be an arrow; a function expression still satisfies
  // func-style:expression. Advance by the items actually returned and stop at
  // `total` — or on an empty page (defensive against a stuck offset / infinite loop).
  const searchAll = async function* (
    query: Omit<SearchQuery, "count" | "start"> = {},
  ): AsyncGenerator<ReadRecord<F>> {
    let start = 0;
    for (;;) {
      const page = await search({ ...query, count: PAGE_SIZE, start });
      for (const item of page.items) yield item;
      start += page.items.length;
      if (page.items.length === 0 || start >= page.total) return;
    }
  };

  const get = async (id: number): Promise<ReadRecord<F> | undefined> => {
    const page = await search({
      condition: { [`${config.prefix}.P_Id:eq`]: String(id) },
      count: 1,
    });
    return page.items[0];
  };

  // create forces P_Id=-1 (non-idempotent: a retry would duplicate); update forces
  // the target id (idempotent: re-applying the same write is safe). Forcing P_Id
  // after the spread means a caller-supplied P_Id never overrides it.
  const write = (item: WriteItem, idempotent: boolean): Promise<number> =>
    deps.requester.request(
      {
        method: "POST",
        url: writeUrl(),
        headers: {},
        body: buildWriteXml({
          resource: config.name,
          prefix: config.prefix,
          fields: fieldMap,
          items: [item],
        }),
      },
      firstWriteId,
      { write: true, idempotent },
    );

  const create = (input: CreateInput<F, Req[number]>): Promise<number> =>
    write({ ...input, P_Id: -1 }, false);

  const update = (id: number, input: UpdateInput<F>): Promise<number> =>
    write({ ...input, P_Id: id }, true);

  return { search, searchAll, get, create, update };
};
