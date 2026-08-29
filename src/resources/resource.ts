// Generic resource accessor (ADR-0004/0005/0011): the Read (search / searchAll /
// get) + Write (create / update) shape shared by every PORTERS resource. A resource
// module supplies its names + Data-Type catalog; this owns the wiring and keeps XML
// out of resources/ (parse/encode live in xml/). Standard `P_` fields use the catalog;
// custom `U_`/`A_` pass through (decode: raw string / encode: Text).

import { PortersResourceError, resourceError } from "../errors";
import { apiUrl, type AccessPoint } from "../http/access-point";
import type { DataType } from "../xml/decode";
import {
  buildWriteXml,
  type WritableDataType,
  type WriteItem,
  type WriteValueOf,
} from "../xml/encode";
import { parseWriteResult } from "../xml/parser";
import {
  appendPaging,
  decoderFor,
  paginate,
  qualifyReadFields,
  runRead,
  type FieldCatalog,
  type ReadFieldAlias,
  type ReadRecord,
  type ResourceDeps,
  type ResourcePage,
} from "./read-core";
import { appendReadQuery, type Condition, type SearchQuery } from "./query";
import { runBulkWrite, type BulkWriteResult } from "./bulk-write";

// Shared Read types/internals live in read-core (reused by master resources). Re-export the
// types so the data-resource modules keep importing them from "./resource".
export type {
  EmptyCatalog,
  FieldCatalog,
  ReadFieldAlias,
  ReadRecord,
  ResourceDeps,
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

/**
 * The tenant-independent half of a resource definition: names + the standard `P_` catalog.
 * Each resource module exports its own (e.g. `CANDIDATE_DESCRIPTOR`) so in-repo dev tooling —
 * the fake server (ADR-0043) — derives wire shapes from the *same* catalog instead of a copy
 * that could drift. Not part of the published API: `src/index.ts` is curated.
 */
export type ResourceDescriptor<F extends FieldCatalog = FieldCatalog> = {
  /** Root element + Write resource name, e.g. `"Candidate"`. */
  name: string;
  /** URL path segment, e.g. `"candidate"`. */
  path: string;
  /** Field alias prefix, e.g. `"Person"`. */
  prefix: string;
  /** Data-Type catalog (`as const`): bare alias -> Data Type. */
  fields: F;
};

/** Static description of a resource: {@link ResourceDescriptor} + required-on-create aliases. */
export type ResourceConfig<
  F extends FieldCatalog,
  Req extends readonly (keyof F)[],
> = ResourceDescriptor<F> & {
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
 * Build a Read URL: `/v1/{path}?partition=…&field=…&condition=…&order=…&keywords=…&itemstate=…&count=…&start=…`
 * at the configured access point (ADR-0047).
 * `ctx` (alias prefix + Data-Type map) drives the typed query encoding (ADR-0038): condition/order
 * prefixing, date ISO -> PORTERS, and the keyword/itemstate guards. It also prefixes the bare
 * `field` aliases (ADR-0059). Attachment is bespoke (no prefix / no catalog) and builds its own
 * loose URL — see attachment.ts.
 */
export const buildReadUrl = <F extends FieldCatalog>(
  accessPoint: AccessPoint,
  partition: number,
  path: string,
  q: SearchQuery<F>,
  ctx: { prefix: string; fields: ReadonlyMap<string, DataType | null> },
): string => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  if (q.field && q.field.length > 0) {
    p.set(
      "field",
      qualifyReadFields(ctx.prefix, ctx.fields, q.field).join(","),
    );
  }
  appendReadQuery(p, q, ctx);
  appendPaging(p, q.count, q.start);
  return apiUrl(accessPoint, path, p);
};

/** Build a Write URL: `/v1/{path}?partition=…` at the configured access point. */
export const buildWriteUrl = (
  accessPoint: AccessPoint,
  partition: number,
  path: string,
): string =>
  apiUrl(
    accessPoint,
    path,
    new URLSearchParams({ partition: String(partition) }),
  );

export const createResource = <
  const F extends FieldCatalog,
  const Req extends readonly (keyof F)[],
>(
  config: ResourceConfig<F, Req>,
  deps: ResourceDeps,
): Resource<F, Req[number]> => {
  // The catalog is `as const` for the types; encode needs a runtime lookup, decode gets its own.
  const fieldMap = new Map<string, DataType | null>(
    Object.entries(config.fields),
  );
  const decode = decoderFor(config.fields);
  // The default field set sent when a caller omits `field` (ADR-0020, 案A+2a): every catalogued
  // alias. PORTERS returns only `{Resource}.P_Id` for a fieldless request, so a typed-record read
  // would otherwise drop every known field despite the type promising them. These are bare aliases
  // like a caller's own list — `buildReadUrl` prefixes both through the same assembly (ADR-0059).
  // The API-native "primary key only" stays reachable via `field: []` (透明化).
  const defaultFields = Object.keys(config.fields) as ReadFieldAlias<F>[];

  const readUrl = (q: SearchQuery<F>): string =>
    buildReadUrl(deps.accessPoint, deps.partition, config.path, q, {
      prefix: config.prefix,
      fields: fieldMap,
    });

  const writeUrl = (): string =>
    buildWriteUrl(deps.accessPoint, deps.partition, config.path);

  const firstWriteId = (body: string): number =>
    firstWriteResultId(body, config.path, config.name);

  // `field` omitted -> send the catalog default; `[]` stays empty (API-native primary key
  // only); a provided list is prefixed and sent (ADR-0020 / ADR-0059).
  // `async` for the exception contract, not for the body: URL building runs the typed-query
  // guards (keyword length, itemstate), and a Promise-returning method must never throw
  // synchronously — every failure reaches the caller as a rejection (ADR-0046).
  const search = async (query: SearchQuery<F> = {}): Promise<ResourcePage<F>> =>
    runRead(
      deps.requester,
      config.name,
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
  // `async` so encoding failures reject rather than throw synchronously (ADR-0046).
  const write = async (item: WriteItem, idempotent: boolean): Promise<number> =>
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
  // `async` for the exception contract: the arguments (URL build, per-item mapping) are evaluated
  // before `runBulkWrite` is entered, so without it a failure there would throw synchronously
  // instead of rejecting (ADR-0046).
  const createMany = async (
    inputs: CreateInput<F, Req[number]>[],
  ): Promise<BulkWriteResult> =>
    runBulkWrite(
      deps.requester,
      { ...target, url: writeUrl() },
      inputs.map((input) => ({ ...input, P_Id: -1 })),
      false,
    );

  const updateMany = async (
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
