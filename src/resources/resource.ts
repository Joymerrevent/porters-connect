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
  type WriteValue,
  type WriteValueOf,
} from "../xml/encode";
import { parseWriteResult, type RawItem } from "../xml/parser";
import {
  decoderFor,
  paginateOnce,
  qualifyReadFields,
  readUrlOf,
  runRead,
  type FieldCatalog,
  type ReadFieldAlias,
  type ResourceDeps,
  type ResourcePageOf,
} from "./read-core";
import { appendReadQuery, type Condition, type SearchQuery } from "./query";
import { runBulkWrite, type BulkWriteResult } from "./bulk-write";
import {
  applyExpand,
  expansionCatalogs,
  guardRawExpansion,
  type EmptyReferences,
  type Expand,
  type ExpandedReadRecord,
  type ExpandSelection,
  type ReferenceMap,
} from "./expand";

// Shared Read types/internals live in read-core (reused by master resources). Re-export the
// types so the data-resource modules keep importing them from "./resource".
export type {
  EmptyCatalog,
  FieldCatalog,
  ReadFieldAlias,
  ReadRecord,
  ResourceDeps,
  ResourcePage,
  ResourcePageOf,
} from "./read-core";
// Typed Read query surface (ADR-0038 / F-2). Defined in query.ts; re-exported so resource modules
// and the public barrel keep importing the query types from "./resource".
export type { Condition, ItemState, Order, SearchQuery } from "./query";
// Bulk write result (ADR-0041 / F-4). Defined in bulk-write.ts; re-exported so resource modules and
// the public barrel keep importing the bulk types from "./resource".
export type { BulkWriteResult, BulkWriteResultItem } from "./bulk-write";
// Reference expansion (ADR-0058). Defined in expand.ts; re-exported for the same reason.
export type {
  EmptyReferences,
  Expand,
  ExpandedReadRecord,
  ReferenceMap,
  ReferenceTarget,
} from "./expand";

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
export type ResourceDescriptor<
  F extends FieldCatalog = FieldCatalog,
  R extends ReferenceMap = ReferenceMap,
> = {
  /** Root element + Write resource name, e.g. `"Candidate"`. */
  name: string;
  /** URL path segment, e.g. `"candidate"`. */
  path: string;
  /** Field alias prefix, e.g. `"Person"`. Empty for a resource whose aliases are bare (Phase). */
  prefix: string;
  /**
   * Primary-key alias. `P_Id` for every resource whose aliases carry the `P_` convention;
   * **Phase names it `Id`** (ADR-0061). Read (`get`) and Write (`create` / `update`) both address
   * the record through it, so it is a fact about the resource, not a constant of the factory.
   * The fake server has always modelled this as `idAlias` — the library catches up here.
   */
  idAlias?: string;
  /** Data-Type catalog (`as const`): bare alias -> Data Type. */
  fields: F;
  /**
   * Expandable `System[Reference]` fields (ADR-0058): bare alias -> the referenced resource's
   * descriptor. The catalog only records that a field *is* a reference, never what it points at,
   * so the link lives here — that is also where Candidate's `Person` alias prefix is absorbed.
   * Omitted, or an alias left out, means the field reads as the referenced id and nothing else.
   */
  references?: R;
};

/**
 * Values a resource always contributes to its own requests, independent of the caller: a fixed
 * Read query parameter and/or a field written on every record. Phase is the only user today —
 * `of(resource)` binds which upper resource's history it addresses, and PORTERS wants that as
 * `resource=` on Read and as the `Resource` field on Write (ADR-0061 案2a).
 */
export type ResourceBindings = {
  readParams?: Readonly<Record<string, string>>;
  writeDefaults?: Readonly<Record<string, WriteValue>>;
};

/** Static description of a resource: {@link ResourceDescriptor} + required-on-create aliases. */
export type ResourceConfig<
  F extends FieldCatalog,
  Req extends readonly (keyof F)[],
  R extends ReferenceMap = EmptyReferences,
> = ResourceDescriptor<F, R> &
  ResourceBindings & {
    /** Aliases required on `create` (PORTERS new-record requirements — ADR-0019 W2). */
    requiredOnCreate: Req;
  };

// Every Read method takes the same shape: the query's `expand` is captured as `E` (a `const` type
// parameter, so the alias lists stay literal) and the record type widens accordingly (ADR-0058).
// Omitting `expand` leaves `E` at the empty default, which collapses back to `ReadRecord<F>`.
export type Resource<
  F extends FieldCatalog,
  Req extends keyof F,
  R extends ReferenceMap = EmptyReferences,
> = {
  search<const E extends Expand<R> = EmptyReferences>(
    query?: SearchQuery<F, R> & { expand?: E },
  ): Promise<ResourcePageOf<ExpandedReadRecord<F, R, E>>>;
  /** Auto-paginating search: yields every matching record (200 per page). */
  searchAll<const E extends Expand<R> = EmptyReferences>(
    query?: Omit<SearchQuery<F, R>, "count" | "start"> & { expand?: E },
  ): AsyncIterable<ExpandedReadRecord<F, R, E>>;
  /** Read one record by id. `expand` reads referenced records too (ADR-0058). */
  get<const E extends Expand<R> = EmptyReferences>(
    id: number,
    options?: { expand?: E },
  ): Promise<ExpandedReadRecord<F, R, E> | undefined>;
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
 * Serialise the Read query — `partition` / `field` / `condition` / `order` / `keywords` /
 * `itemstate` — into the parameters every page of that query shares. **Paging is deliberately not
 * here**: `count` / `start` are the only parts that differ page to page, so `readUrlOf` adds them
 * to a copy and `searchAll` can serialise the caller's query exactly once (RV-32).
 * `ctx` (alias prefix + Data-Type map + reference targets) drives the typed query encoding
 * (ADR-0038): condition/order prefixing, date ISO -> PORTERS, and the keyword/itemstate guards.
 * It also assembles `field` from the bare aliases (ADR-0059) and folds `expand` into that list
 * (ADR-0058). Attachment is bespoke (no prefix / no catalog) and builds its own loose URL — see
 * attachment.ts.
 */
export const buildReadParams = <F extends FieldCatalog, R extends ReferenceMap>(
  partition: number,
  q: SearchQuery<F, R>,
  ctx: {
    prefix: string;
    fields: ReadonlyMap<string, DataType | null>;
    references?: ReferenceMap;
    /**
     * Fixed query parameters this resource always sends. **Phase requires `resource=`** — the
     * upper resource whose history is being read — and it is a parameter of its own, not a
     * `condition` (ADR-0061 / Phase Read). Set once by the accessor, never by the caller.
     */
    params?: Readonly<Record<string, string>>;
  },
): URLSearchParams => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  for (const [key, value] of Object.entries(ctx.params ?? {}))
    p.set(key, value);
  if (q.field && q.field.length > 0) {
    // The typed `Expand<R>` is what constrains callers; the assembly below is purely structural,
    // like `encodeCondition` over the loose catalog.
    guardRawExpansion(q.field, ctx.fields);
    const entries = applyExpand(
      qualifyReadFields(ctx.prefix, ctx.fields, q.field),
      q.expand,
      { prefix: ctx.prefix, references: ctx.references ?? {} },
    );
    p.set("field", entries.join(","));
  }
  appendReadQuery(p, q, ctx);
  return p;
};

/**
 * Build a Read URL: `/v1/{path}?partition=…&field=…&condition=…&order=…&keywords=…&itemstate=…&count=…&start=…`
 * at the configured access point (ADR-0047) — the single-page form of {@link buildReadParams}.
 */
export const buildReadUrl = <F extends FieldCatalog, R extends ReferenceMap>(
  accessPoint: AccessPoint,
  partition: number,
  path: string,
  q: SearchQuery<F, R>,
  ctx: Parameters<typeof buildReadParams<F, R>>[2],
): string =>
  readUrlOf(
    accessPoint,
    path,
    buildReadParams(partition, q, ctx),
    q.count,
    q.start,
  );

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
  const R extends ReferenceMap = EmptyReferences,
>(
  config: ResourceConfig<F, Req, R>,
  deps: ResourceDeps,
): Resource<F, Req[number], R> => {
  // The catalog is `as const` for the types; encode needs a runtime lookup, decode gets its own.
  const fieldMap = new Map<string, DataType | null>(
    Object.entries(config.fields),
  );
  const references: ReferenceMap = config.references ?? {};
  // `P_Id` unless the resource says otherwise (Phase uses `Id` — ADR-0061).
  const idAlias = config.idAlias ?? "P_Id";
  const decode = decoderFor(config.fields);
  // The default field set sent when a caller omits `field` (ADR-0020, 案A+2a): every catalogued
  // alias. PORTERS returns only `{Resource}.P_Id` for a fieldless request, so a typed-record read
  // would otherwise drop every known field despite the type promising them. These are bare aliases
  // like a caller's own list — `buildReadUrl` prefixes both through the same assembly (ADR-0059).
  // The API-native "primary key only" stays reachable via `field: []` (透明化).
  const defaultFields = Object.keys(config.fields) as ReadFieldAlias<F>[];

  const readParams = (q: SearchQuery<F, R>): URLSearchParams =>
    buildReadParams(deps.partition, q, {
      prefix: config.prefix,
      fields: fieldMap,
      references,
      params: config.readParams,
    });

  const readUrl = (q: SearchQuery<F, R>): string =>
    readUrlOf(deps.accessPoint, config.path, readParams(q), q.count, q.start);

  const writeUrl = (): string =>
    buildWriteUrl(deps.accessPoint, deps.partition, config.path);

  const firstWriteId = (body: string): number =>
    firstWriteResultId(body, config.path, config.name);

  // An expanded read needs a decoder that knows the *referenced* catalogs (ADR-0058); a plain one
  // reuses the cached decoder. `Record<K, T>` cannot express "the record widens with E", so the
  // decoder is cast at this one seam — `expansionCatalogs` and `ExpandedReadRecord` are derived
  // from the same `expand`, so they cannot disagree about which aliases were expanded.
  const decoderWith = <T>(
    expand: ExpandSelection | undefined,
  ): ((item: RawItem) => T) => {
    const expansions = expansionCatalogs(expand, references);
    return (
      expansions === undefined ? decode : decoderFor(config.fields, expansions)
    ) as (item: RawItem) => T;
  };

  // `field` omitted -> send the catalog default; `[]` stays empty (API-native primary key
  // only); a provided list is prefixed and sent (ADR-0020 / ADR-0059).
  // `async` for the exception contract, not for the body: URL building runs the typed-query
  // guards (keyword length, itemstate, raw expansions), and a Promise-returning method must never
  // throw synchronously — every failure reaches the caller as a rejection (ADR-0046).
  const search = async <const E extends Expand<R> = EmptyReferences>(
    query: SearchQuery<F, R> & { expand?: E } = {},
  ): Promise<ResourcePageOf<ExpandedReadRecord<F, R, E>>> =>
    runRead(
      deps.requester,
      config.name,
      readUrl({ ...query, field: query.field ?? defaultFields }),
      decoderWith<ExpandedReadRecord<F, R, E>>(query.expand),
    );

  // The caller's query object is read **once**, when the first page is asked for: what the walk
  // keeps is the serialised parameters and the decoder, not the object. Writing to that object
  // (`q.condition.P_Name.part = …`) between pages therefore cannot change a later page — the walk
  // stays "every record matching the query as it was handed over" (RV-32). Building inside the
  // generator keeps guard failures arriving as a rejected iteration (ADR-0046), and drops the
  // per-page re-serialisation the old form paid for.
  const searchAll = <const E extends Expand<R> = EmptyReferences>(
    query: Omit<SearchQuery<F, R>, "count" | "start"> & { expand?: E } = {},
  ): AsyncIterable<ExpandedReadRecord<F, R, E>> =>
    paginateOnce(() => {
      const base = readParams({
        ...query,
        field: query.field ?? defaultFields,
      });
      const decode = decoderWith<ExpandedReadRecord<F, R, E>>(query.expand);
      return (count, start) =>
        runRead(
          deps.requester,
          config.name,
          readUrlOf(deps.accessPoint, config.path, base, count, start),
          decode,
        );
    });

  const get = async <const E extends Expand<R> = EmptyReferences>(
    id: number,
    options: { expand?: E } = {},
  ): Promise<ExpandedReadRecord<F, R, E> | undefined> => {
    // Every catalog carries a primary key (System[Id]); the generic `F` can't prove it
    // statically, so build the condition at runtime and let the encoder qualify it
    // (`{prefix}.{idAlias}:eq=id`, or just `{idAlias}` when there is no prefix).
    const condition = { [idAlias]: { eq: id } } as unknown as Condition<F>;
    const page = await search<E>({
      condition,
      count: 1,
      expand: options.expand,
    });
    return page.items[0];
  };

  // create forces P_Id=-1 (non-idempotent: a retry would duplicate); update forces
  // the target id (idempotent: re-applying the same write is safe). Forcing P_Id
  // after the spread means a caller-supplied P_Id never overrides it.
  // `async` so encoding failures reject rather than throw synchronously (ADR-0046).
  // Fields the resource itself contributes to every record (Phase's `Resource` — ADR-0061).
  // Spread first so a caller can never shadow the binding they did not choose.
  const withDefaults = (item: WriteItem): WriteItem => ({
    ...config.writeDefaults,
    ...item,
  });

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
    write(withDefaults({ ...input, [idAlias]: -1 }), false);

  const update = (id: number, input: UpdateInput<F>): Promise<number> =>
    write(withDefaults({ ...input, [idAlias]: id }), true);

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
      inputs.map((input) => withDefaults({ ...input, [idAlias]: -1 })),
      false,
    );

  const updateMany = async (
    items: { id: number; fields: UpdateInput<F> }[],
  ): Promise<BulkWriteResult> =>
    runBulkWrite(
      deps.requester,
      { ...target, url: writeUrl() },
      items.map(({ id, fields }) => withDefaults({ ...fields, [idAlias]: id })),
      true,
    );

  return { search, searchAll, get, create, update, createMany, updateMany };
};
