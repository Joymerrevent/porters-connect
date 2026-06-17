// Field master accessor (read-only — ADR-0021/0022). Field Read introspects a resource's
// field catalog (standard `P_` + tenant `U_`/`A_`). It requires `partition` and `resource`
// (a resource-type Value code), plus optional `active`. No `field`/`condition`/`get(id)`.
// `P_ReferTo` is a nested alias (the option group for Option-type fields, the parent field for
// Reference-type) — decoded like an Option value to the referenced alias(es) (ADR-0022).

import type { Requester } from "../http/requester";
import {
  decoderFor,
  paginate,
  runRead,
  type FieldCatalog,
  type ReadRecord,
  type ResourcePage,
} from "./read-core";

// Resource-type selector -> Value code (docs/reference resources-list). Master/Phase/Attachment
// have no Value, so only the R/W data resources are selectable here.
const RESOURCE_VALUE = {
  candidate: 1,
  job: 3,
  client: 5,
  recruiter: 9,
  sales: 11,
  contract: 13,
  resume: 17,
  activity: 19,
  opportunity: 25,
  contact: 27,
} as const;

/** A resource whose field catalog can be read (Field Read `resource` selector). */
export type ResourceType = keyof typeof RESOURCE_VALUE;

const FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
  P_Alias: "SinglelineText",
  P_Type: "Number",
  P_Required: "Number",
  P_Max: "Number",
  P_Min: "Number",
  P_DecimalFraction: "Number",
  // Nested alias(es): the referenced option group / parent field. Reuse Option decode -> the
  // referenced alias(es) as string[] (usually one); empty -> null (ADR-0017/0022).
  // VERIFY(live): Reference-type P_ReferTo nesting is doc-only. See docs/live-verification.md (LV-6).
  P_ReferTo: "Option",
  P_ResourceType: "Number",
} as const satisfies FieldCatalog;

/** A decoded Field definition. `P_Required`: 0 = normal, 1 = required. */
export type Field = ReadRecord<typeof FIELDS>;
export type FieldPage = ResourcePage<typeof FIELDS>;

/** Field Read query. `resource` selects which resource's fields to read (required). */
export type FieldSearchQuery = {
  resource: ResourceType;
  /** -1 = all (default), 0 = unused only, 1 = in-use only. */
  active?: -1 | 0 | 1;
  count?: number;
  start?: number;
};

export type FieldResource = {
  search(query: FieldSearchQuery): Promise<FieldPage>;
  /** Auto-paginating search: yields every field of the resource. */
  searchAll(
    query: Omit<FieldSearchQuery, "count" | "start">,
  ): AsyncIterable<Field>;
};

const buildUrl = (
  host: string,
  partition: number,
  q: FieldSearchQuery,
): string => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  p.set("resource", String(RESOURCE_VALUE[q.resource]));
  p.set("active", String(q.active ?? -1));
  if (q.count !== undefined) p.set("count", String(q.count));
  if (q.start !== undefined) p.set("start", String(q.start));
  return `https://${host}/v1/field?${p.toString()}`;
};

export const createFieldResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): FieldResource => {
  const decode = decoderFor(FIELDS);
  const search = (query: FieldSearchQuery): Promise<FieldPage> =>
    runRead(deps.requester, buildUrl(deps.host, deps.partition, query), decode);
  const searchAll = (
    query: Omit<FieldSearchQuery, "count" | "start">,
  ): AsyncIterable<Field> =>
    paginate((count, start) => search({ ...query, count, start }));
  return { search, searchAll };
};
