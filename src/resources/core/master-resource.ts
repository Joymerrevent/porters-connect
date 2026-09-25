// The master resources' accessor: the read-only masters' counterpart of `data-resource.ts`. A
// master has no Write, so the accessor is its Read (`master-read.ts`) alone; this file names the
// shape it takes. What each master's Read accepts stays with that master, passed in as `params`
// (ADR-0022).

import type {
  FieldCatalog,
  Paging,
  ReadRecord,
  ResourceDeps,
  ResourcePageOf,
} from "./read";
import { createMasterReader, type MasterReadConfig } from "./master-read";

// Function-typed properties rather than methods: they close over the config, never `this`, so a
// caller may take them apart (`const { search } = …`).
/** A master resource's Read: `Q` is its own query (paging aside), `T` the record it returns. */
export type MasterResource<Q, T> = {
  search: (query?: Q & Paging) => Promise<ResourcePageOf<T>>;
  searchAll: (query?: Q) => AsyncIterable<T>;
};

/** Static description of a master resource: what its Read needs (a master has no Write). */
export type MasterResourceConfig<F extends FieldCatalog, Q> = MasterReadConfig<
  F,
  Q
>;

/** The accessor for a read-only master resource: its `search` and `searchAll`. */
export const createMasterResource = <const F extends FieldCatalog, Q>(
  config: MasterResourceConfig<F, Q>,
  deps: Pick<ResourceDeps, "requester" | "accessPoint">,
): MasterResource<Q, ReadRecord<F>> => ({
  ...createMasterReader(config, deps),
});
