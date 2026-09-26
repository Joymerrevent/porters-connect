// The data resources' Read (search / searchAll / get / getMany): the factory that sends them. The
// record type they resolve to is `read-record.ts`. `data-resource.ts` puts this together with
// the Write half (`write-data.ts`) into one accessor. Master resources have their own, smaller Read
// (`read-master.ts`); both share the paging / decoding / sending in `read.ts`.

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
import { readMany } from "./read-many";
import {
  expansionCatalogs,
  type EmptyReferences,
  type Expand,
  type ExpandedReadRecord,
  type ExpandSelection,
  type ReferenceMap,
} from "./expand";
import type { ImageOption, ImageReadRecord } from "./image";
import { idAliasOf, type ResourceDescriptor } from "./descriptor";
import type { EmptyImages } from "./read-record";

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
  // Phase uses `Id` (ADR-0061).
  const idAlias = idAliasOf(config);
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

  // What a Read resolves to for a given `expand` / `image`: the record widened by the expansion,
  // with the selected Image sub-fields. The public types narrow it further by `field` (ADR-0096).
  type Selected<
    E extends Expand<R>,
    I extends ImageOption<F>,
  > = ImageReadRecord<ExpandedReadRecord<F, R, E>, I>;
  // What `get` / `getMany` take besides the ids: the same selection a search takes.
  type IdReadOptions<E, I> = {
    field?: readonly ReadFieldAlias<F>[];
    expand?: E;
    image?: I;
  };

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

  // One query, ready to send: its serialised parameters and the decoder its `expand` needs. Running
  // it evaluates the typed-query guards (keyword length, itemstate, raw expansions), so both callers
  // run it where a failure becomes a rejection, never a synchronous throw (ADR-0046).
  const prepare = <E extends Expand<R>, I extends ImageOption<F>>(
    query: SearchQuery<F, R>,
  ) => ({
    base: readParams(query),
    decode: decoderWith<Selected<E, I>>(query.expand),
  });

  const search = async <
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    query: SearchQuery<F, R> & Paging & { expand?: E; image?: I } = {},
  ): Promise<ResourcePageOf<Selected<E, I>>> => {
    const { base, decode } = prepare<E, I>(query);
    return read(base, decode, query.count, query.start);
  };

  // The caller's query object is read **once**, when the first page is asked for: what the walk
  // keeps is the prepared parameters and decoder, not the object. Writing to that object
  // (`q.condition.P_Name.part = …`) between pages therefore cannot change a later page — the walk
  // stays "every record matching the query as it was handed over" (RV-32). Preparing inside the
  // generator keeps guard failures arriving as a rejected iteration (ADR-0046).
  const searchAll = <
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    query: SearchQuery<F, R> & { expand?: E; image?: I } = {},
  ): AsyncIterable<Selected<E, I>> =>
    paginateOnce(() => {
      const { base, decode } = prepare<E, I>(query);
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
    options: IdReadOptions<E, I> = {},
  ): Promise<Selected<E, I> | undefined> => {
    const page = await search<E, I>({
      condition: idCondition("eq", id),
      count: 1,
      field: withIdField(options.field),
      expand: options.expand,
      image: options.image,
    });
    return page.items[0];
  };

  // The chunking, the check against the requested ids and the ordering are `readMany`'s
  // (ADR-0095); what this resource supplies is how to read one chunk.
  const getMany = async <
    const E extends Expand<R> = EmptyReferences,
    const I extends ImageOption<F> = EmptyImages,
  >(
    ids: readonly number[],
    options: IdReadOptions<E, I> = {},
  ): Promise<(Selected<E, I> | undefined)[]> => {
    const field = withIdField(options.field);
    const query = (chunk: readonly number[], count: number) => ({
      condition: idCondition("or", [...chunk]),
      count,
      field,
      expand: options.expand,
      image: options.image,
    });
    return readMany(ids, {
      read: (chunk) => search<E, I>(query(chunk, chunk.length)),
      // Measured at the largest `count` so a real (smaller) chunk is never longer than measured.
      urlLength: (chunk) => readUrl(query(chunk, MAX_READ_COUNT)).length,
      idOf: (record) => (record as Record<string, unknown>)[idAlias],
      resource: config.name,
    });
  };

  return { search, searchAll, get, getMany };
};
