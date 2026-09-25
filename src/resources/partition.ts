// Partition master accessor (read-only — ADR-0021/0022). Partition Read discovers the
// partitions an App can access. It takes neither `partition` nor `field`/`condition`, only
// `request_type`: 1 = the accessible-partition list (works under code_direct; the default),
// 0 = the login partition (only under the browser `code` grant — 403s under code_direct, so
// Partition has no `current()`; ADR-0022 D3b). `requestType: 0` stays on the query for a caller
// whose token came from the browser grant. No `get(id)`: the API has no id/condition filter.

import type { Connection } from "./core/read";
import type { ResourceDescriptor } from "./core/descriptor";
import {
  type FieldCatalog,
  type Paging,
  type ReadRecord,
  type ResourcePage,
} from "./core/read";
import { createMasterResource } from "./core/master-resource";

const FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
  P_CompanyId: "SinglelineText",
} as const satisfies FieldCatalog;

/**
 * Partition's names + catalog. Exported for in-repo dev tooling — the fake server (ADR-0043)
 * builds Partition Read responses from this very catalog, so the two cannot drift. The alias
 * prefix is the resource name itself (`Partition.P_Id` — docs/usage/reference). Not re-exported from
 * `src/index.ts`, so it stays out of the published API.
 */
export const PARTITION_DESCRIPTOR = {
  name: "Partition",
  path: "partition",
  prefix: "Partition",
  fields: FIELDS,
} as const satisfies ResourceDescriptor;

/** A decoded Partition (a PORTERS contract company / Company DB). */
export type Partition = ReadRecord<typeof FIELDS>;
export type PartitionPage = ResourcePage<typeof FIELDS>;

/** Partition Read query. `requestType` 1 = partitions this App can access (default). */
export type PartitionSearchQuery = {
  /** 1 = accessible partitions (default). 0 = login partition (browser `code` grant only). */
  requestType?: 0 | 1;
};

export type PartitionResource = {
  search(query?: PartitionSearchQuery & Paging): Promise<PartitionPage>;
  /** Auto-paginating search: yields every accessible partition. */
  searchAll(query?: PartitionSearchQuery): AsyncIterable<Partition>;
};

// VERIFY(live): Partition Read taking no `partition` param is doc-only (every other read
// requires it). See docs/live-verification.md (LV-8).
// The parameters Partition Read takes; paging and sending are the shared `createMasterResource`.
const buildParams = (q: PartitionSearchQuery): URLSearchParams => {
  const p = new URLSearchParams();
  p.set("request_type", String(q.requestType ?? 1));
  return p;
};

export const createPartitionResource = (deps: Connection): PartitionResource =>
  createMasterResource({ ...PARTITION_DESCRIPTOR, params: buildParams }, deps);
