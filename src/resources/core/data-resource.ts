// The data resources' accessor (ADR-0004/0005/0011): the Read (search / searchAll / get / getMany)
// + Write (create / update / bulk) shape shared by every PORTERS data resource. A resource
// module supplies its names + Data-Type catalog; this owns the wiring and keeps XML
// out of resources/ (parse/encode live in xml/). Standard `P_` fields use the catalog;
// custom `U_`/`A_` pass through (decode: raw string / encode: Text).
// The read-only master resources have their own, smaller counterpart: `master-resource.ts`.

import { PortersConfigError } from "../../errors";
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
  createPageReader,
  decoderFor,
  paginateOnce,
  readUrlOf,
  type FieldCatalog,
  type Paging,
  type ReadFieldAlias,
  type ResourceDeps,
  type ResourcePageOf,
} from "./read";
import { buildReadParams, type Condition, type SearchQuery } from "./query";
import { runBulkWrite, type BulkWriteResult } from "./bulk-write";
import { MAX_READ_COUNT } from "../../porters/read-rules";
import { packIds, recordsById } from "./get-many";
import {
  expansionCatalogs,
  type EmptyReferences,
  type Expand,
  type ExpandedReadRecord,
  type ExpandSelection,
  type ReferenceMap,
} from "./expand";
import {
  guardImageWrite,
  guardNoImageInBulk,
  type ImageOption,
  type ImageReadRecord,
} from "./image";
import type { ResourceDescriptor } from "./descriptor";
import { buildWriteUrl, firstWriteResultId } from "./write";

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
export type DataResourceConfig<
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

// 宣言が違うスコープを取り違えないための印（ADR-0074 D1 の「項目が違えばスコープの型も違う」を保つ）。
// `field` を型引数で受けるようにしたら（ADR-0096）、それまで `field` の引数の型が担っていた比べ方
// （一方の項目名がもう一方にすべて含まれるときだけ通る）が消えたので、同じ比べ方をするメソッドを印として置く。
// メソッドの引数は双方向に比べられる（bivariant）ので、含む向き・含まれる向きのどちらかで通り、どちらでもなければ落ちる。
// 各リソースの公開の型が `import type` してメンバーに置く（ADR-0100）。交差型（`{ [catalogMark]?… } & { search… }`）
// にすると、`TenantScope<DeclaredCatalogs>` が宣言したスコープを受けなくなる（型引数の比べ方が変わる）ので、
// 必ずメソッドと同じオブジェクト型のメンバーにする。
export declare const catalogMark: unique symbol;

// PORTERS の主キーの alias。データ系は `P_Id`、Phase だけ `Id`（ADR-0061）。レコードの型に在る方だけが残る。
type IdKey = "P_Id" | "Id";

// 戻り値の型を要求した項目に絞るのは ADR-0096。キーは省略可能のまま（要求した項目が必ず返るとは約束しない）。
/**
 * The record a Read returns, keyed by what was asked for. `FL` is the `field` list as written:
 * omitted (`undefined`) keeps every known field; a literal list keeps those fields plus the ones
 * named in `expand` / `image` (they are requested too); `[]` keeps nothing but `Always`. A list the
 * compiler cannot see as literal (a `string[]` variable) keeps every field. Keys stay optional.
 * `Always` is what the method requests regardless of `field` — `get` / `getMany` read the id and,
 * because the id keeps `field` non-empty, whatever `expand` / `image` name.
 */
export type RequestedRecord<
  Rec,
  FL,
  E,
  I,
  Always extends PropertyKey = never,
> = [FL] extends [undefined]
  ? Rec
  : Pick<
      Rec,
      Extract<
        keyof Rec,
        | (FL extends readonly []
            ? never
            : (FL extends readonly (infer A)[] ? A : never) | keyof E | keyof I)
        | Always
      >
    >;

// `?: never` で塞ぐ経緯は RV-47（spread で束縛が矛盾する形）。使い道は Phase の受けないクエリのキー
// （ADR-0076）と束ねる項目（ADR-0061 / ADR-0080）。
/**
 * An object with `K` taken out — and **kept out**. `Omit` alone only stops a fresh object literal
 * (excess-property checking); a variable that happens to carry the key still assigns. Re-declaring
 * each removed key as `?: never` closes that hole, so the call fails whichever way the object was
 * built — including `create({ ...recordFromRead })`.
 */
export type Without<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: never;
};

/**
 * What a Read selects besides its conditions: the `field` list, the references to `expand` and
 * the Image sub-fields to read (`image`). Each is captured as a type parameter so the record type
 * can follow it.
 */
export type ReadSelection<FL, E, I> = {
  field?: FL;
  expand?: E;
  image?: I;
};

/** The options of `get` / `getMany`: the same selection a search takes. */
export type GetOptions<F extends FieldCatalog, FL, E, I> = {
  field?: FL & readonly ReadFieldAlias<F>[];
  expand?: E;
  image?: I;
};

/** The record `search` / `searchAll` resolve to for a given `expand` / `image` / `field`. */
export type SearchRecord<
  F extends FieldCatalog,
  R extends ReferenceMap,
  E extends Expand<R>,
  I extends ImageOption<F>,
  FL,
> = RequestedRecord<ImageReadRecord<ExpandedReadRecord<F, R, E>, I>, FL, E, I>;

/**
 * The record `get` / `getMany` resolve to: like {@link SearchRecord}, plus the id and whatever
 * `expand` / `image` name, which are read even when `field` leaves them out.
 */
export type GetRecord<
  F extends FieldCatalog,
  R extends ReferenceMap,
  E extends Expand<R>,
  I extends ImageOption<F>,
  FL,
> = RequestedRecord<
  ImageReadRecord<ExpandedReadRecord<F, R, E>, I>,
  FL,
  E,
  I,
  IdKey | keyof E | keyof I
>;

// 各リソースの公開の型は、それぞれのファイルでメソッドを書き出す（ADR-0100）。この型は factory が返す
// 実装の形で、データ系の公開の型が揃っていることを確かめる型のテストの基準にもなる。
// Every Read method takes the same shape: the query's `expand` / `image` are captured as `E` / `I`
// (`const` type parameters, so the alias lists stay literal) and the record type widens accordingly
// (ADR-0058 / ADR-0064). Omitting them leaves both at the empty default, which collapses back to
// `ReadRecord<F>`.
export type DataResource<
  F extends FieldCatalog,
  Req extends keyof F,
  R extends ReferenceMap = EmptyReferences,
> = {
  /** @internal Type-level mark of the field catalog; never present at runtime. */
  [catalogMark]?(field: ReadFieldAlias<F>): void;
  search<
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
    const FL extends readonly ReadFieldAlias<F>[] | undefined = undefined,
  >(
    query?: SearchQuery<F, R> & Paging & ReadSelection<FL, E, I>,
  ): Promise<ResourcePageOf<SearchRecord<F, R, E, I, FL>>>;
  searchAll<
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
    const FL extends readonly ReadFieldAlias<F>[] | undefined = undefined,
  >(
    query?: SearchQuery<F, R> & ReadSelection<FL, E, I>,
  ): AsyncIterable<SearchRecord<F, R, E, I, FL>>;
  get<
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
    const FL extends readonly ReadFieldAlias<F>[] | undefined = undefined,
  >(
    id: number,
    options?: GetOptions<F, FL, E, I>,
  ): Promise<GetRecord<F, R, E, I, FL> | undefined>;
  getMany<
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
    const FL extends readonly ReadFieldAlias<F>[] | undefined = undefined,
  >(
    ids: readonly number[],
    options?: GetOptions<F, FL, E, I>,
  ): Promise<(GetRecord<F, R, E, I, FL> | undefined)[]>;
  create(input: CreateInput<F, Req>): Promise<number>;
  update(id: number, input: UpdateInput<F>): Promise<number>;
  createMany(inputs: CreateInput<F, Req>[]): Promise<BulkWriteResult>;
  updateMany(
    items: { id: number; fields: UpdateInput<F> }[],
  ): Promise<BulkWriteResult>;
};

export const createDataResource = <
  const F extends FieldCatalog,
  const Req extends readonly (keyof F)[],
  const R extends ReferenceMap = EmptyReferences,
>(
  config: DataResourceConfig<F, Req, R>,
  deps: ResourceDeps,
): DataResource<F, Req[number], R> => {
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

  // `field` omitted -> send the catalog default; `[]` stays empty (API-native primary key
  // only); a provided list is prefixed and sent (ADR-0020 / ADR-0059). The default is applied
  // here, once, so every Read (search / searchAll / get / getMany) gets it the same way.
  const readParams = (q: SearchQuery<F, R>): URLSearchParams =>
    buildReadParams(
      deps.partition,
      { ...q, field: q.field ?? defaultFields },
      {
        prefix: config.prefix,
        fields: fieldMap,
        references,
        params: config.readParams,
      },
    );

  const readUrl = (q: SearchQuery<F, R> & Paging): string =>
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

  const read = createPageReader({
    requester: deps.requester,
    accessPoint: deps.accessPoint,
    name: config.name,
    path: config.path,
  });

  // `async` for the exception contract, not for the body: URL building runs the typed-query
  // guards (keyword length, itemstate, raw expansions), and a Promise-returning method must never
  // throw synchronously — every failure reaches the caller as a rejection (ADR-0046).
  const search = async <
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    query: SearchQuery<F, R> & Paging & { expand?: E; image?: I } = {},
  ): Promise<ResourcePageOf<ImageReadRecord<ExpandedReadRecord<F, R, E>, I>>> =>
    read(
      readParams(query),
      decoderWith<ImageReadRecord<ExpandedReadRecord<F, R, E>, I>>(
        query.expand,
      ),
      query.count,
      query.start,
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
    query: SearchQuery<F, R> & {
      expand?: E;
      image?: I;
    } = {},
  ): AsyncIterable<ImageReadRecord<ExpandedReadRecord<F, R, E>, I>> =>
    paginateOnce(() => {
      const base = readParams(query);
      const decode = decoderWith<
        ImageReadRecord<ExpandedReadRecord<F, R, E>, I>
      >(query.expand);
      return (count, start) => read(base, decode, count, start);
    });

  // `get` / `getMany` always read the id, even when the caller's `field` leaves it out: `getMany`
  // matches every record back to a requested id, and `get` follows the same rule so the two agree
  // (ADR-0095). Omitted `field` stays omitted — the catalog default already holds the id.
  const withIdField = (
    field: readonly ReadFieldAlias<F>[] | undefined,
  ): readonly ReadFieldAlias<F>[] | undefined =>
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
    options: {
      field?: readonly ReadFieldAlias<F>[];
      expand?: E;
      image?: I;
    } = {},
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
    options: {
      field?: readonly ReadFieldAlias<F>[];
      expand?: E;
      image?: I;
    } = {},
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
      (chunk) => readUrl(query(chunk, MAX_READ_COUNT)).length,
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
