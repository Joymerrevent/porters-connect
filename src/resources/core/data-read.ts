// The data resources' Read (search / searchAll / get / getMany): the query they take, the record
// type they resolve to, and the factory that sends them. `data-resource.ts` puts this together with
// the Write half (`data-write.ts`) into one accessor. Master resources have their own, smaller Read
// (`master-read.ts`); both share the paging / decoding / sending in `read.ts`.

import type { RawItem } from "../../xml/parser";
import { createPageReader, readUrlOf, type ResourcePageOf } from "./read";
import { decoderFor } from "./decoder";
import { paginateOnce, type Paging } from "./paging";
import type { FieldCatalog, ReadFieldAlias } from "./catalog";
import type { ResourceDeps } from "./deps";
import type { Condition, SearchQuery } from "./query";
import { buildReadParams, type ReadParamsContext } from "./query-encode";
import { fieldParamContext } from "./field-param";
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
import type { ImageOption, ImageReadRecord } from "./image";
import type { ResourceDescriptor } from "./descriptor";

/**
 * "No image sub-fields selected": the identity default for the image generic, mirroring
 * {@link EmptyReferences}. With no keys, `ImageReadRecord` collapses back to the record it wrapped.
 */
export type EmptyImages = Record<never, never>;

// PORTERS の主キーの alias。データ系は `P_Id`、Phase だけ `Id`（ADR-0061）。レコードの型に在る方だけが残る。
type IdKey = "P_Id" | "Id";

// `field` のリストに書いた alias（リテラルのリストから取り出す）。
type ListedKeys<FL> = FL extends readonly (infer A)[] ? A : never;

// `field` のリストで要求したキー。`expand` / `image` で選んだ alias も送られるので含める。
// `field: []` は主キーしか送らないので、何も要求していない（`expand` / `image` も送られない）。
type SelectedKeys<FL, E, I> = FL extends readonly []
  ? never
  : ListedKeys<FL> | keyof E | keyof I;

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
  : Pick<Rec, Extract<keyof Rec, SelectedKeys<FL, E, I> | Always>>;

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

/**
 * What the Read half needs: the resource's {@link ResourceDescriptor}, plus any Read query
 * parameter the resource always sends, independent of the caller. Phase is the only user today —
 * `of(resource)` binds which upper resource's history it reads, and PORTERS wants that as
 * `resource=` (ADR-0061 案2a).
 */
export type DataReadConfig<
  F extends FieldCatalog,
  R extends ReferenceMap = EmptyReferences,
> = ResourceDescriptor<F, R> & {
  readParams?: Readonly<Record<string, string>>;
};

// 公開の形（引数・戻り値の型）は data-resource.ts の DataResource が決める。ここが返すのは実装の型で、
// DataResource に代入できることを createDataResource の戻り値の型で確かめる。
/** `search` / `searchAll` / `get` / `getMany` for a data resource. */
export const createDataReader = <
  const F extends FieldCatalog,
  const R extends ReferenceMap = EmptyReferences,
>(
  config: DataReadConfig<F, R>,
  deps: ResourceDeps,
) => {
  const references: ReferenceMap = config.references ?? {};
  // `P_Id` unless the resource says otherwise (Phase uses `Id` — ADR-0061).
  const idAlias = config.idAlias ?? "P_Id";
  const decode = decoderFor(config.fields);
  // `field` omitted -> every catalogued alias (ADR-0020): PORTERS returns only `{Resource}.P_Id` for
  // a fieldless request, so a typed-record read would otherwise drop every known field despite the
  // type promising them. `[]` stays empty (API-native primary key only). The default and the rest of
  // the `field` assembly are `fieldParam`'s, the same for every Read (search / searchAll / get /
  // getMany) and for the masters.
  const readContext: ReadParamsContext = {
    ...fieldParamContext(config.prefix, config.fields, references),
    params: config.readParams,
  };
  const readParams = (q: SearchQuery<F, R>): URLSearchParams =>
    buildReadParams(deps.partition, q, readContext);

  const readUrl = (q: SearchQuery<F, R> & Paging): string =>
    readUrlOf(deps.accessPoint, config.path, readParams(q), q.count, q.start);

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

  return { search, searchAll, get, getMany };
};
