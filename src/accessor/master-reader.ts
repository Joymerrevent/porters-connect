// The master resources' Read (search / searchAll): how a read-only master's Read is sent — the
// library's own contract, kept in one place so it changes in one place (the data resources'
// counterpart is `read-data.ts`). Every master resource used to spell it out itself, and each
// change to the contract below had to be repeated in all of them (ADR-0046 / RV-15, ADR-0051 /
// RV-20, RV-28, RV-32, ADR-0047). `master-resource.ts` turns this into the accessor.
//
//   - a Promise-returning method never throws synchronously — `search` is `async` (ADR-0046)
//   - `searchAll` serialises the caller's query once, at the first page (RV-32)
//   - `count` is checked against PORTERS' range before sending (`pageUrl` — RV-28)
//   - the response must be PORTERS' own answer for this resource (`runRead` — ADR-0051)
//   - the URL is built at the configured access point (`pageUrl` — ADR-0047)
//
// What a resource's Read *accepts* — its parameters and their defaults — is PORTERS' rule for that
// resource and stays with the resource, passed in as `params` (ADR-0022).

import type { ResourceDescriptor } from "./descriptor";
import { createPageReader } from "./page-reader";
import type { ResourcePageOf } from "./resource-page";
import { createDecoder } from "./decoder";
import { paginateOnce } from "./paginate";
import type { Paging } from "./paging";
import type { FieldCatalog, ReadRecord } from "./catalog";
import type { ConnectionDeps } from "./deps";

/**
 * What a master's Read needs: its descriptor (names + `P_` catalog, like a data resource's) and
 * the parameters its Read takes. `params` is PORTERS' rule for this master (ADR-0022) and never
 * sends `count` / `start` — paging is added per page.
 */
export type MasterReadConfig<
  F extends FieldCatalog,
  Q,
> = ResourceDescriptor<F> & {
  params: (query: Q) => URLSearchParams;
};

// 公開の形は master-resource.ts の MasterResource が決める。ここが返すのは実装の型で、
// MasterResource に代入できることを createMasterResource の戻り値の型で確かめる。
/**
 * `search` and `searchAll` for a read-only master resource. The counterpart of
 * `createDataReader`: both take the resource's config and the connection, and derive the decoder
 * and the record type from the catalog. Only the connection is needed — not the partition, which
 * a master's own `params` sends or not (Partition Read takes none).
 */
export const createMasterReader = <const F extends FieldCatalog, Q>(
  config: MasterReadConfig<F, Q>,
  deps: ConnectionDeps,
) => {
  const decode = createDecoder(config.fields);
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
