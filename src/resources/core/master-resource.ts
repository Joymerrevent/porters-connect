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

import type { AccessPoint } from "../../http/access-point";
import type { Requester } from "../../http/requester";
import type { RawItem } from "../../xml/parser";
import { createPageReader, paginateOnce, type ResourcePageOf } from "./read";

/** The paging half of a Read query; everything else is the resource's own. */
type Paging = { count?: number; start?: number };

// Function-typed properties rather than methods: they close over `spec`, never `this`, so a caller
// may take them apart (`const { search } = …`).
export type MasterResource<Q extends Paging, T> = {
  search: (query?: Q) => Promise<ResourcePageOf<T>>;
  searchAll: (query?: Omit<Q, "count" | "start">) => AsyncIterable<T>;
};

export type MasterResourceSpec<Q extends Paging, T> = {
  requester: Requester;
  accessPoint: AccessPoint;
  /** Root element of the response (and the error context), e.g. `"User"`. */
  name: string;
  /** URL path segment, e.g. `"user"`. */
  path: string;
  decode: (item: RawItem) => T;
  /** The resource's own parameters for a query — never `count` / `start`. */
  params: (query: Omit<Q, "count" | "start">) => URLSearchParams;
};

/** `search` and `searchAll` for a resource whose Read takes `params` plus paging. */
export const createMasterResource = <Q extends Paging, T>(
  spec: MasterResourceSpec<Q, T>,
): MasterResource<Q, T> => {
  const read = createPageReader(spec);
  const search = async (query: Q = {} as Q): Promise<ResourcePageOf<T>> =>
    read(spec.params(query), spec.decode, query.count, query.start);
  const searchAll = (
    query: Omit<Q, "count" | "start"> = {} as Omit<Q, "count" | "start">,
  ): AsyncIterable<T> =>
    paginateOnce(() => {
      const base = spec.params(query);
      return (count, start) => read(base, spec.decode, count, start);
    });
  return { search, searchAll };
};
