// The data resources' accessor (ADR-0004/0005/0011): the Read (search / searchAll / get / getMany)
// + Write (create / update / bulk) shape shared by every PORTERS data resource. A resource
// module supplies its names + Data-Type catalog; this puts the Read half (`data-reader.ts`) and the
// Write half (`data-writer.ts`) together and keeps XML out of resources/ (parse/encode live in
// xml/). Standard `P_` fields use the catalog; custom `U_`/`A_` pass through (decode: raw string /
// encode: Text). The read-only master resources have their own, smaller counterpart:
// `master-resource.ts`.

import type { FieldCatalog, ReadFieldAlias } from "./catalog";
import type { Paging } from "./paging";
import type { PartitionBoundConnectionDeps } from "./deps";
import type { ResourcePageOf } from "./resource-page";
import type { SearchQuery } from "./query";
import type { BulkWriteResult } from "./write-many";
import type { EmptyReferences, Expand, ReferenceMap } from "./expand";
import type { ImageOption } from "./image";
import { createDataReader, type DataReadConfig } from "./data-reader";
import type {
  EmptyImages,
  GetOptions,
  GetRecord,
  ReadSelection,
  SearchRecord,
} from "./read-record";
import { createDataWriter, type DataWriteConfig } from "./data-writer";
import type { CreateInput, UpdateInput } from "./write-record";

/** Static description of a data resource: what its Read half and its Write half need. */
export type DataResourceConfig<
  F extends FieldCatalog,
  Req extends readonly (keyof F)[],
  R extends ReferenceMap = EmptyReferences,
> = DataReadConfig<F, R> & DataWriteConfig<F, Req>;

// 宣言が違うスコープを取り違えないための印（ADR-0074 D1 の「項目が違えばスコープの型も違う」を保つ）。
// `field` を型引数で受けるようにしたら（ADR-0096）、それまで `field` の引数の型が担っていた比べ方
// （一方の項目名がもう一方にすべて含まれるときだけ通る）が消えたので、同じ比べ方をするメソッドを印として置く。
// メソッドの引数は双方向に比べられる（bivariant）ので、含む向き・含まれる向きのどちらかで通り、どちらでもなければ落ちる。
// 各リソースの公開の型が `import type` してメンバーに置く（ADR-0100）。交差型（`{ [catalogMark]?… } & { search… }`）
// にすると、`TenantScope<DeclaredCatalogs>` が宣言したスコープを受けなくなる（型引数の比べ方が変わる）ので、
// 必ずメソッドと同じオブジェクト型のメンバーにする。
export declare const catalogMark: unique symbol;

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
  deps: PartitionBoundConnectionDeps,
): DataResource<F, Req[number], R> => ({
  ...createDataReader(config, deps),
  ...createDataWriter(config, deps),
});
