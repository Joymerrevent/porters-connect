// The master resources' accessor: how a read-only master's Read is sent — the library's own
// contract, kept in one place so it changes in one place (the data resources' counterpart is
// `data-resource.ts`). Every master resource used to spell it out itself, and each change to the
// contract below had to be repeated in all of them (ADR-0046 / RV-15, ADR-0051 / RV-20, RV-28,
// RV-32, ADR-0047).
//
//   - a Promise-returning method never throws synchronously — `search` is `async` (ADR-0046)
//   - `searchAll` serialises the caller's query once, at the first page (RV-32)
//   - `count` is checked against PORTERS' range before sending (`readUrlOf` — RV-28)
//   - the response must be PORTERS' own answer for this resource (`runRead` — ADR-0051)
//   - the URL is built at the configured access point (`readUrlOf` — ADR-0047)
//
// What a resource's Read *accepts* — its parameters and their defaults — is PORTERS' rule for that
// resource and stays with the resource, passed in as `params` (ADR-0022).

import type { ResourceDescriptor } from "./descriptor";
import {
  createPageReader,
  decoderFor,
  paginateOnce,
  type FieldCatalog,
  type Paging,
  type ReadRecord,
  type ResourceDeps,
  type ResourcePageOf,
} from "./read";

// Function-typed properties rather than methods: they close over the config, never `this`, so a
// caller may take them apart (`const { search } = …`).
/** A master resource's Read: `Q` is its own query (paging aside), `T` the record it returns. */
export type MasterResource<Q, T> = {
  search: (query?: Q & Paging) => Promise<ResourcePageOf<T>>;
  searchAll: (query?: Q) => AsyncIterable<T>;
};

/**
 * A master resource: its descriptor (names + `P_` catalog, like a data resource's) and the
 * parameters its Read takes. `params` is PORTERS' rule for this master (ADR-0022) and never sends
 * `count` / `start` — paging is added per page.
 */
export type MasterResourceConfig<
  F extends FieldCatalog,
  Q,
> = ResourceDescriptor<F> & {
  params: (query: Q) => URLSearchParams;
};

/**
 * `search` and `searchAll` for a read-only master resource. The counterpart of
 * `createDataResource`: both take the resource's config and the connection, and derive the
 * decoder and the record type from the catalog. Only the connection is needed — not the
 * partition, which a master's own `params` sends or not (Partition Read takes none).
 */
export const createMasterResource = <const F extends FieldCatalog, Q>(
  config: MasterResourceConfig<F, Q>,
  deps: Pick<ResourceDeps, "requester" | "accessPoint">,
): MasterResource<Q, ReadRecord<F>> => {
  const decode = decoderFor(config.fields);
  const read = createPageReader({
    requester: deps.requester,
    accessPoint: deps.accessPoint,
    name: config.name,
    path: config.path,
  });
  const search = async (
    query: Q & Paging = {} as Q & Paging,
  ): Promise<ResourcePageOf<ReadRecord<F>>> =>
    read(config.params(query), decode, query.count, query.start);
  const searchAll = (query: Q = {} as Q): AsyncIterable<ReadRecord<F>> =>
    paginateOnce(() => {
      const base = config.params(query);
      return (count, start) => read(base, decode, count, start);
    });
  return { search, searchAll };
};
