// Generic resource accessor (ADR-0004/0005/0011): the Read (search / searchAll /
// get) + Write (create / update) shape shared by every PORTERS resource. A resource
// module supplies its names + Data-Type catalog; this owns the wiring and keeps XML
// out of resources/ (parse/encode live in xml/). Standard `P_` fields use the catalog;
// custom `U_`/`A_` pass through (decode: raw string / encode: Text).

import { PortersResourceError, resourceError } from "../errors";
import type { Requester } from "../http/requester";
import type { DataType } from "../xml/decode";
import {
  buildWriteXml,
  type WritableDataType,
  type WriteItem,
  type WriteValueOf,
} from "../xml/encode";
import { parseWriteResult } from "../xml/parser";
import {
  decoderFor,
  paginate,
  runRead,
  type FieldCatalog,
  type ReadRecord,
  type ResourcePage,
} from "./read-core";
import { appendReadQuery, type Condition, type SearchQuery } from "./query";
import { runBulkWrite, type BulkWriteResult } from "./bulk-write";

// Shared Read types/internals live in read-core (reused by master resources). Re-export the
// types so the data-resource modules keep importing them from "./resource".
export type {
  EmptyCatalog,
  FieldCatalog,
  ReadRecord,
  ResourcePage,
} from "./read-core";
// Typed Read query surface (ADR-0038 / F-2). Defined in query.ts; re-exported so resource modules
// and the public barrel keep importing the query types from "./resource".
export type { Condition, ItemState, Order, SearchQuery } from "./query";
// Bulk write result (ADR-0041 / F-4). Defined in bulk-write.ts; re-exported so resource modules and
// the public barrel keep importing the bulk types from "./resource".
export type { BulkWriteResult, BulkWriteResultItem } from "./bulk-write";

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
  search(query?: SearchQuery<F>): Promise<ResourcePage<F>>;
  /** Auto-paginating search: yields every matching record (200 per page). */
  searchAll(
    query?: Omit<SearchQuery<F>, "count" | "start">,
  ): AsyncIterable<ReadRecord<F>>;
  get(id: number): Promise<ReadRecord<F> | undefined>;
  /** Create one record; resolves to the newly assigned id. */
  create(input: CreateInput<F, Req>): Promise<number>;
  /** Update one record by id; resolves to that id. */
  update(id: number, input: UpdateInput<F>): Promise<number>;
  /**
   * Create many records in one call (ADR-0041 / F-4). Auto-batched to ≤200 records and under the
   * request size cap. **Not atomic** — inspect the {@link BulkWriteResult}: per-record failures are
   * returned (`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
   * already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
   * duplicate creates. Empty input sends no request.
   */
  createMany(inputs: CreateInput<F, Req>[]): Promise<BulkWriteResult>;
  /**
   * Update many records by id in one call (ADR-0041 / F-4). Auto-batched like {@link createMany};
   * per-record failures are returned in the {@link BulkWriteResult}, not thrown.
   */
  updateMany(
    items: { id: number; fields: UpdateInput<F> }[],
  ): Promise<BulkWriteResult>;
};

// The 4 readable sub-fields of a User-type field (docs/reference: only these are returned).
const USER_SUBFIELDS = ["P_Id", "P_Type", "P_Name", "P_Mail"] as const;

// Default Read `field` list derived from the catalog (ADR-0020, 案A+2a). PORTERS returns only
// `{Resource}.P_Id` for a fieldless request, so a typed-record read would otherwise drop every
// known field despite the type promising them. We send every catalog alias as `{prefix}.{alias}`,
// expanding User to its 4 readable sub-fields and leaving System[Reference] ID-only (`()` omitted)
// so the wire shape matches decode.ts. The API-native "primary key only" stays reachable via
// `field: []` (透明化 — see SearchQuery.field).
const defaultFieldList = (prefix: string, fields: FieldCatalog): string[] =>
  Object.entries(fields).map(([alias, type]) =>
    type === "User"
      ? `${prefix}.${alias}(${USER_SUBFIELDS.map((s) => `User.${s}`).join(",")})`
      : `${prefix}.${alias}`,
  );

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

/**
 * Build a Read URL: `https://{host}/v1/{path}?partition=…&field=…&condition=…&order=…&keywords=…&itemstate=…&count=…&start=…`.
 * `ctx` (alias prefix + Data-Type map) drives the typed query encoding (ADR-0038): condition/order
 * prefixing, date ISO -> PORTERS, and the keyword/itemstate guards. Attachment is bespoke (no prefix
 * / no catalog) and builds its own loose URL — see attachment.ts.
 */
export const buildReadUrl = <F extends FieldCatalog>(
  host: string,
  partition: number,
  path: string,
  q: SearchQuery<F>,
  ctx: { prefix: string; fields: ReadonlyMap<string, DataType> },
): string => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  if (q.field && q.field.length > 0) p.set("field", q.field.join(","));
  appendReadQuery(p, q, ctx);
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
  // The catalog is `as const` for the types; encode needs a runtime lookup, decode gets its own.
  const fieldMap = new Map<string, DataType>(Object.entries(config.fields));
  const decode = decoderFor(config.fields);
  // Computed once: the default field set sent when a caller omits `field` (ADR-0020).
  const defaultFields = defaultFieldList(config.prefix, config.fields);

  const readUrl = (q: SearchQuery<F>): string =>
    buildReadUrl(deps.host, deps.partition, config.path, q, {
      prefix: config.prefix,
      fields: fieldMap,
    });

  const writeUrl = (): string =>
    buildWriteUrl(deps.host, deps.partition, config.path);

  const firstWriteId = (body: string): number =>
    firstWriteResultId(body, config.path, config.name);

  // `field` omitted -> send the catalog default; `[]` stays empty (API-native primary key
  // only); a provided list is sent verbatim (ADR-0020).
  const search = (query: SearchQuery<F> = {}): Promise<ResourcePage<F>> =>
    runRead(
      deps.requester,
      readUrl({ ...query, field: query.field ?? defaultFields }),
      decode,
    );

  const searchAll = (
    query: Omit<SearchQuery<F>, "count" | "start"> = {},
  ): AsyncIterable<ReadRecord<F>> =>
    paginate((count, start) => search({ ...query, count, start }));

  const get = async (id: number): Promise<ReadRecord<F> | undefined> => {
    // Every catalog carries `P_Id` (System[Id]); the generic `F` can't prove it statically, so
    // build the condition at runtime and let the encoder prefix it (`{prefix}.P_Id:eq=id`).
    const condition = { P_Id: { eq: id } } as unknown as Condition<F>;
    const page = await search({ condition, count: 1 });
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

  // Bulk write (ADR-0041): map each input to a WriteItem with its P_Id (create = -1, update = id) —
  // mirroring single write — and hand the array to the batching executor. createMany is
  // non-idempotent (P_Id=-1), updateMany idempotent (targets ids).
  const target = {
    name: config.name,
    prefix: config.prefix,
    fields: fieldMap,
    partition: deps.partition,
  };
  const createMany = (
    inputs: CreateInput<F, Req[number]>[],
  ): Promise<BulkWriteResult> =>
    runBulkWrite(
      deps.requester,
      { ...target, url: writeUrl() },
      inputs.map((input) => ({ ...input, P_Id: -1 })),
      false,
    );

  const updateMany = (
    items: { id: number; fields: UpdateInput<F> }[],
  ): Promise<BulkWriteResult> =>
    runBulkWrite(
      deps.requester,
      { ...target, url: writeUrl() },
      items.map(({ id, fields }) => ({ ...fields, P_Id: id })),
      true,
    );

  return { search, searchAll, get, create, update, createMany, updateMany };
};
