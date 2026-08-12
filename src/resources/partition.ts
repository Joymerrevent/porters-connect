// Partition master accessor (read-only — ADR-0021/0022). Partition Read discovers the
// partitions an App can access. It takes neither `partition` nor `field`/`condition`, only
// `request_type`: 1 = the accessible-partition list (works under code_direct; the default),
// 0 = the login partition (only under the browser `code` grant — 403s under code_direct, so
// it is not exposed; ADR-0022 D3b). No `get(id)`: the API has no id/condition filter.

import { apiUrl, type AccessPoint } from "../http/access-point";
import type { ResourceDeps, ResourceDescriptor } from "./resource";
import {
  decoderFor,
  paginate,
  runRead,
  type FieldCatalog,
  type ReadRecord,
  type ResourcePage,
} from "./read-core";

const FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
  P_CompanyId: "SinglelineText",
} as const satisfies FieldCatalog;

/**
 * Partition's names + catalog. Exported for in-repo dev tooling — the fake server (ADR-0043)
 * builds Partition Read responses from this very catalog, so the two cannot drift. The alias
 * prefix is the resource name itself (`Partition.P_Id` — docs/reference). Not re-exported from
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
  count?: number;
  start?: number;
};

export type PartitionResource = {
  search(query?: PartitionSearchQuery): Promise<PartitionPage>;
  /** Auto-paginating search: yields every accessible partition. */
  searchAll(
    query?: Omit<PartitionSearchQuery, "count" | "start">,
  ): AsyncIterable<Partition>;
};

// VERIFY(live): Partition Read taking no `partition` param is doc-only (every other read
// requires it). See docs/live-verification.md (LV-8).
const buildUrl = (
  accessPoint: AccessPoint,
  q: PartitionSearchQuery,
): string => {
  const p = new URLSearchParams();
  p.set("request_type", String(q.requestType ?? 1));
  if (q.count !== undefined) p.set("count", String(q.count));
  if (q.start !== undefined) p.set("start", String(q.start));
  return apiUrl(accessPoint, "partition", p);
};

export const createPartitionResource = (
  deps: Omit<ResourceDeps, "partition">,
): PartitionResource => {
  const decode = decoderFor(FIELDS);
  // `async` for the exception contract: a Promise-returning public method never throws
  // synchronously, whatever URL building does (ADR-0046).
  const search = async (
    query: PartitionSearchQuery = {},
  ): Promise<PartitionPage> =>
    runRead(deps.requester, buildUrl(deps.accessPoint, query), decode);
  const searchAll = (
    query: Omit<PartitionSearchQuery, "count" | "start"> = {},
  ): AsyncIterable<Partition> =>
    paginate((count, start) => search({ ...query, count, start }));
  return { search, searchAll };
};
