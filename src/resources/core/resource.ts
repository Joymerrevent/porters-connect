// Generic resource accessor (ADR-0004/0005/0011): the Read (search / searchAll /
// get) + Write (create / update) shape shared by every PORTERS resource. A resource
// module supplies its names + Data-Type catalog; this owns the wiring and keeps XML
// out of resources/ (parse/encode live in xml/). Standard `P_` fields use the catalog;
// custom `U_`/`A_` pass through (decode: raw string / encode: Text).

import { PortersConfigError } from "../../errors";
import type { AccessPoint } from "../../http/access-point";
import type { DataType } from "../../porters/data-type";
import {
  buildWriteXml,
  type WritableDataType,
  type WriteItem,
  type WriteValue,
  type WriteValueOf,
} from "../../xml/encode";
import type { RawItem } from "../../xml/parser";
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
} from "./read";
import { appendReadQuery, type Condition, type SearchQuery } from "./query";
import { runBulkWrite, type BulkWriteResult } from "./bulk-write";
import { MAX_READ_COUNT } from "../../porters/read-rules";
import { packIds, recordsById } from "./get-many";
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
import {
  applyImage,
  guardImageWrite,
  guardNoImageInBulk,
  type ImageOption,
  type ImageReadRecord,
} from "./image";

// Shared Read types/internals live in core/read (reused by master resources). Re-export the
// types so the data-resource modules keep importing them from "./resource".
export type {
  EmptyCatalog,
  FieldCatalog,
  ReadFieldAlias,
  ReadRecord,
  ResourceDeps,
  ResourcePage,
  ResourcePageOf,
} from "./read";
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
import type { ResourceDescriptor } from "./descriptor";
import { buildWriteUrl, firstWriteResultId } from "./write";
// Image sub-field selection (ADR-0064). Defined in image.ts; re-exported for the same reason.
export type { ImageOption, ImageReadRecord, ImageSelectedValue } from "./image";

// Writable aliases: every field whose Data Type a user may write (excludes System[Id] /
// System[DateTime] — ADR-0016/0019).
type WritableKeys<F extends FieldCatalog> = {
  [K in keyof F]: F[K] extends WritableDataType ? K : never;
}[keyof F];

// 書き込み入力の形は ADR-0019 W2。
/**
 * Create input: the `requiredOnCreate` aliases are **required** (non-null); every
 * other writable field is optional (`null` omits). `P_Id` is supplied by the library — not here.
 */
export type CreateInput<F extends FieldCatalog, Req extends keyof F> = {
  [K in Req]: WriteValueOf<F[K]>;
} & {
  [K in Exclude<WritableKeys<F>, Req>]?: WriteValueOf<F[K]> | null;
};

/** Update input: every writable field optional (`null` omits, `""` clears). */
export type UpdateInput<F extends FieldCatalog> = {
  [K in WritableKeys<F>]?: WriteValueOf<F[K]> | null;
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
    /**
     * Aliases required on `create` (PORTERS new-record requirements — ADR-0019 W2). Only the
     * aliases PORTERS marks `●` (unconditionally required) belong here; `※` (conditionally
     * required) fields stay optional and PORTERS arbitrates them (ADR-0083).
     */
    requiredOnCreate: Req;
  };

/**
 * "No image sub-fields selected": the identity default for the image generic, mirroring
 * {@link EmptyReferences}. With no keys, `ImageReadRecord` collapses back to the record it wrapped.
 */
export type EmptyImages = Record<never, never>;

// `?: never` で塞ぐ経緯は RV-47（spread で束縛が矛盾する形）。Unsupported は ADR-0076、
// Bound は ADR-0061 / ADR-0080。
/**
 * An object with `K` taken out — and **kept out**. `Omit` alone only stops a fresh object literal
 * (excess-property checking); a variable that happens to carry the key still assigns. Re-declaring
 * each removed key as `?: never` closes that hole, so the call fails whichever way the object was
 * built — including `create({ ...recordFromRead })`, which is how the binding actually gets
 * contradicted in practice.
 *
 * Used for two different exclusions: query keys the endpoint does not take (`Unsupported`)
 * and write aliases the accessor itself fills (`Bound`).
 * `searchAll` keeps a plain `Omit` for `count` / `start`: those are not "PORTERS does not take
 * this", they are "the walk decides them", and tightening that is a different decision.
 */
type Without<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: never;
};

// Every Read method takes the same shape: the query's `expand` / `image` are captured as `E` / `I`
// (`const` type parameters, so the alias lists stay literal) and the record type widens accordingly
// (ADR-0058 / ADR-0064). Omitting them leaves both at the empty default, which collapses back to
// `ReadRecord<F>`.
export type Resource<
  F extends FieldCatalog,
  Req extends keyof F,
  R extends ReferenceMap = EmptyReferences,
  // 端点ごとに語彙を狭める設計は ADR-0076。実行時は寛容のまま（ADR-0074）。
  /**
   * Query keys **this endpoint does not take**. The common Read vocabulary is not
   * universal: PORTERS lists `keywords` / `itemstate` for the 11 common data resources and for
   * none of the others, so a resource on this factory can say which of them its own endpoint
   * leaves out. `never` — the default — means "takes the whole vocabulary".
   *
   * Sending a parameter the endpoint does not list can fail the *whole* Read (Result Code 100 /
   * 102), so the safe side is not to offer it. The runtime stays permissive: a key
   * forced in through a cast is still sent, which is how a live contract can test whether
   * PORTERS accepts it at all.
   */
  Unsupported extends keyof SearchQuery<F, R> = never,
  // of() で束ねた alias を入力から外す設計は ADR-0061、型で塞ぐ経緯は RV-47。
  /**
   * Write aliases **the accessor itself fills**, so a caller cannot supply them.
   * `t.phase.of("client")` binds `Resource`; passing it again could only mean contradicting the
   * binding, and a phase written to the wrong resource cannot be deleted (there is no delete API).
   * `never` — the default — means the caller supplies every writable field.
   */
  Bound extends WritableKeys<F> = never,
> = {
  search<
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    query?: Without<SearchQuery<F, R>, Unsupported> & {
      expand?: E;
      image?: I;
    },
  ): Promise<ResourcePageOf<ImageReadRecord<ExpandedReadRecord<F, R, E>, I>>>;
  /** Auto-paginating search: yields every matching record (200 per page). */
  searchAll<
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    query?: Omit<Without<SearchQuery<F, R>, Unsupported>, "count" | "start"> & {
      expand?: E;
      image?: I;
    },
  ): AsyncIterable<ImageReadRecord<ExpandedReadRecord<F, R, E>, I>>;
  /**
   * Read one record by id; `undefined` when there is none. `field` picks the fields to read, the
   * same way it does for `search` (omit it to read every known field); the record's id is always
   * read, even when `field` leaves it out. `expand` reads referenced records too; `image` picks an
   * Image field's sub-tags — `get` is where asking for a `Content` belongs, since it
   * fetches one record rather than a page.
   */
  get<
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    id: number,
    options?: { field?: ReadFieldAlias<F>[]; expand?: E; image?: I },
  ): Promise<ImageReadRecord<ExpandedReadRecord<F, R, E>, I> | undefined>;
  // 設計は ADR-0095（ID の突き合わせ・組分け・戻り値の形）。
  /**
   * Read many records by id. Resolves to an array in the order of `ids`, holding `undefined`
   * where no record has that id — the same answer {@link get} gives for one id. A repeated id
   * gets the same record at each of its positions; an empty `ids` sends no request.
   *
   * The ids are sent together (up to 200 per request, and as many as fit under the request size
   * limit), so this makes far fewer requests than calling `get` for each id. Takes the same
   * options as `get`; narrowing `field` shortens each request, so more ids fit in one.
   *
   * Every record that comes back is checked against the ids that were asked for. If PORTERS
   * returns one that was not requested, the call rejects instead of returning it.
   */
  getMany<
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    ids: readonly number[],
    options?: { field?: ReadFieldAlias<F>[]; expand?: E; image?: I },
  ): Promise<(ImageReadRecord<ExpandedReadRecord<F, R, E>, I> | undefined)[]>;
  /** Create one record; resolves to the newly assigned id. */
  create(
    input: Without<
      CreateInput<F, Req>,
      Extract<Bound, keyof CreateInput<F, Req>>
    >,
  ): Promise<number>;
  /** Update one record by id; resolves to that id. */
  update(
    id: number,
    input: Without<UpdateInput<F>, Extract<Bound, keyof UpdateInput<F>>>,
  ): Promise<number>;
  // 一括書き込みの設計は ADR-0041 / F-4。
  /**
   * Create many records in one call. Auto-batched to ≤200 records and under the
   * request size cap. **Not atomic** — inspect the {@link BulkWriteResult}: per-record failures are
   * returned (`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
   * already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
   * duplicate creates. Empty input sends no request.
   */
  createMany(
    inputs: Without<
      CreateInput<F, Req>,
      Extract<Bound, keyof CreateInput<F, Req>>
    >[],
  ): Promise<BulkWriteResult>;
  /**
   * Update many records by id in one call. Auto-batched like {@link createMany};
   * per-record failures are returned in the {@link BulkWriteResult}, not thrown.
   */
  updateMany(
    items: {
      id: number;
      fields: Without<UpdateInput<F>, Extract<Bound, keyof UpdateInput<F>>>;
    }[],
  ): Promise<BulkWriteResult>;
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
    const entries = applyImage(
      applyExpand(
        qualifyReadFields(ctx.prefix, ctx.fields, q.field),
        q.expand,
        {
          prefix: ctx.prefix,
          references: ctx.references ?? {},
        },
      ),
      q.image,
      ctx.prefix,
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
  const search = async <
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    query: SearchQuery<F, R> & { expand?: E; image?: I } = {},
  ): Promise<ResourcePageOf<ImageReadRecord<ExpandedReadRecord<F, R, E>, I>>> =>
    runRead(
      deps.requester,
      config.name,
      readUrl({ ...query, field: query.field ?? defaultFields }),
      decoderWith<ImageReadRecord<ExpandedReadRecord<F, R, E>, I>>(
        query.expand,
      ),
    );

  // The caller's query object is read **once**, when the first page is asked for: what the walk
  // keeps is the serialised parameters and the decoder, not the object. Writing to that object
  // (`q.condition.P_Name.part = …`) between pages therefore cannot change a later page — the walk
  // stays "every record matching the query as it was handed over" (RV-32). Building inside the
  // generator keeps guard failures arriving as a rejected iteration (ADR-0046), and drops the
  // per-page re-serialisation the old form paid for.
  const searchAll = <
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    query: Omit<SearchQuery<F, R>, "count" | "start"> & {
      expand?: E;
      image?: I;
    } = {},
  ): AsyncIterable<ImageReadRecord<ExpandedReadRecord<F, R, E>, I>> =>
    paginateOnce(() => {
      const base = readParams({
        ...query,
        field: query.field ?? defaultFields,
      });
      const decode = decoderWith<
        ImageReadRecord<ExpandedReadRecord<F, R, E>, I>
      >(query.expand);
      return (count, start) =>
        runRead(
          deps.requester,
          config.name,
          readUrlOf(deps.accessPoint, config.path, base, count, start),
          decode,
        );
    });

  // `get` / `getMany` always read the id, even when the caller's `field` leaves it out: `getMany`
  // matches every record back to a requested id, and `get` follows the same rule so the two agree
  // (ADR-0095). Omitted `field` stays omitted — the catalog default already holds the id.
  const withIdField = (
    field: ReadFieldAlias<F>[] | undefined,
  ): ReadFieldAlias<F>[] | undefined =>
    field === undefined || field.includes(idAlias)
      ? field
      : [idAlias, ...field];

  // Every catalog carries a primary key (System[Id]); the generic `F` can't prove it
  // statically, so build the condition at runtime and let the encoder qualify it
  // (`{prefix}.{idAlias}:eq=id`, or just `{idAlias}` when there is no prefix).
  const idCondition = (
    op: "eq" | "or",
    value: number | number[],
  ): Condition<F> =>
    ({ [idAlias]: { [op]: value } }) as unknown as Condition<F>;

  const get = async <
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    id: number,
    options: { field?: ReadFieldAlias<F>[]; expand?: E; image?: I } = {},
  ): Promise<ImageReadRecord<ExpandedReadRecord<F, R, E>, I> | undefined> => {
    const page = await search<E, I>({
      condition: idCondition("eq", id),
      count: 1,
      field: withIdField(options.field),
      expand: options.expand,
      image: options.image,
    });
    return page.items[0];
  };

  // ids are de-duplicated, split into requests that fit (≤200 and under the size limit), read in
  // turn, and every page is checked against its own chunk before anything is kept (ADR-0095).
  // A failure in any chunk rejects the whole call: a Read is safe to repeat, and a partial answer
  // would look like "those ids do not exist".
  const getMany = async <
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    ids: readonly number[],
    options: { field?: ReadFieldAlias<F>[]; expand?: E; image?: I } = {},
  ): Promise<
    (ImageReadRecord<ExpandedReadRecord<F, R, E>, I> | undefined)[]
  > => {
    type Rec = ImageReadRecord<ExpandedReadRecord<F, R, E>, I>;
    const field = withIdField(options.field);
    const query = (chunk: readonly number[], count: number) => ({
      condition: idCondition("or", [...chunk]),
      count,
      field,
      expand: options.expand,
      image: options.image,
    });
    // Measured at the largest `count` so a real (smaller) chunk is never longer than measured.
    const chunks = packIds(
      [...new Set(ids)],
      (chunk) =>
        readUrl({
          ...query(chunk, MAX_READ_COUNT),
          field: field ?? defaultFields,
        }).length,
    );
    const found = new Map<number, Rec>();
    for (const chunk of chunks) {
      const page = await search<E, I>(query(chunk, chunk.length));
      const matched = recordsById(
        page,
        chunk,
        (record) => (record as Record<string, unknown>)[idAlias],
        config.name,
      );
      for (const [id, record] of matched) found.set(id, record);
    }
    return ids.map((id) => found.get(id));
  };

  // create forces P_Id=-1 (non-idempotent: a retry would duplicate); update forces
  // the target id (idempotent: re-applying the same write is safe). Forcing P_Id
  // after the spread means a caller-supplied P_Id never overrides it.
  // Fields the accessor itself contributes to every record (Phase's `Resource` — ADR-0061).
  //
  // The binding is **authoritative**: a caller who supplies one of these aliases can only be
  // contradicting it, so we refuse the write rather than pick a winner (RV-47). Silently dropping
  // the caller's value would be the other failure — a setting that looks applied and is not
  // (RV-10). The spread puts the defaults **last** as well, so even a value that reached here
  // through some other path cannot override the binding.
  const boundAliases = Object.keys(config.writeDefaults ?? {});
  const withDefaults = (item: WriteItem): WriteItem => {
    // `?: never` は `undefined` を許すので、**値が入っているときだけ**弾く（型と実行時を揃える）。
    const supplied = boundAliases.filter((alias) => item[alias] !== undefined);
    if (supplied.length > 0) {
      throw new PortersConfigError(
        `${config.name}: ${supplied.join(", ")} is set by the accessor and cannot be written`,
        {
          category: "config",
          hint: `The accessor already binds ${supplied.join(", ")} (e.g. t.phase.of("client")). Drop it from the input, or bind a different resource.`,
        },
      );
    }
    return { ...item, ...config.writeDefaults };
  };

  const write = async (
    item: WriteItem,
    idempotent: boolean,
  ): Promise<number> => {
    // An image is checked against PORTERS' own limits here and then sent with the ~15000-char
    // request guard lifted — a 2MB Base64 body can never fit under it (ADR-0064 論点3). The guard
    // is only lifted for a write that actually carries one, and only after those checks passed.
    const hasImage = guardImageWrite(item, fieldMap);
    return deps.requester.request(
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
      // Spread rather than `unboundedBody: hasImage`: a write with no image keeps the exact spec
      // it always had, so the opt-out shows up only where it was actually taken.
      { write: true, idempotent, ...(hasImage ? { unboundedBody: true } : {}) },
    );
  };

  // `async` for the exception contract: `withDefaults` runs while the arguments are evaluated,
  // i.e. before `write` is entered, so without it a refused bound alias (RV-47) would throw
  // synchronously instead of rejecting (ADR-0046). Found as RV-64.
  const create = async (input: CreateInput<F, Req[number]>): Promise<number> =>
    write(withDefaults({ ...input, [idAlias]: -1 }), false);

  const update = async (id: number, input: UpdateInput<F>): Promise<number> =>
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
  ): Promise<BulkWriteResult> => {
    const records = inputs.map((input) =>
      withDefaults({ ...input, [idAlias]: -1 }),
    );
    guardNoImageInBulk(records, fieldMap, "createMany");
    return runBulkWrite(
      deps.requester,
      { ...target, url: writeUrl() },
      records,
      false,
    );
  };

  const updateMany = async (
    items: { id: number; fields: UpdateInput<F> }[],
  ): Promise<BulkWriteResult> => {
    const records = items.map(({ id, fields }) =>
      withDefaults({ ...fields, [idAlias]: id }),
    );
    guardNoImageInBulk(records, fieldMap, "updateMany");
    return runBulkWrite(
      deps.requester,
      { ...target, url: writeUrl() },
      records,
      true,
    );
  };

  return {
    search,
    searchAll,
    get,
    getMany,
    create,
    update,
    createMany,
    updateMany,
  };
};
