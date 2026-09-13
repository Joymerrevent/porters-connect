// Field master accessor (read-only — ADR-0021/0022). Field Read introspects a resource's
// field catalog (standard `P_` + tenant `U_`/`A_`). It requires `partition` and `resource`
// (a resource-type Value code), plus optional `active`. No `field`/`condition`/`get(id)`.
// `P_ReferTo` is a nested alias (the option group for Option-type fields, the parent field for
// Reference-type) — decoded like an Option value to the referenced alias(es) (ADR-0022).

import type { ResourceDeps, ResourceDescriptor } from "./resource";
import {
  decoderFor,
  paginateOnce,
  readUrlOf,
  runRead,
  type FieldCatalog,
  type ReadRecord,
  type ResourcePage,
} from "./read-core";
import { RESOURCE_VALUES, type ResourceName } from "./resource-list";

/**
 * A resource whose field catalog can be read (Field Read `resource` selector).
 *
 * Field Read takes a Resource List Value, so the selectable set **is** the set PORTERS gives a
 * Value — the same one `t.phase.of()` accepts. This is an alias rather than a second table on
 * purpose: `field.ts` used to keep its own copy and it silently lost Process (RV-37), so the
 * Value table lives in one place (`resource-list.ts`) and both roles read from it.
 */
export type ResourceType = ResourceName;

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

/**
 * Field's names + catalog. Exported for in-repo dev tooling — the fake server (ADR-0043)
 * builds Field Read responses from this very catalog, so the two cannot drift. The alias
 * prefix is the resource name itself (`Field.P_Id` — docs/usage/reference). Not re-exported from
 * `src/index.ts`, so it stays out of the published API.
 */
export const FIELD_DESCRIPTOR = {
  name: "Field",
  path: "field",
  prefix: "Field",
  fields: FIELDS,
} as const satisfies ResourceDescriptor;

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

// Paging is left out on purpose: `count` / `start` are the only per-page difference, so
// `searchAll` serialises the caller's query once and `readUrlOf` adds the rest (RV-32).
const buildParams = (
  partition: number,
  q: Omit<FieldSearchQuery, "count" | "start">,
): URLSearchParams => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  p.set("resource", String(RESOURCE_VALUES[q.resource]));
  p.set("active", String(q.active ?? -1));
  return p;
};

export const createFieldResource = (deps: ResourceDeps): FieldResource => {
  const decode = decoderFor(FIELDS);
  // `async` for the exception contract (ADR-0046).
  const readUrl = (q: FieldSearchQuery): string =>
    readUrlOf(
      deps.accessPoint,
      "field",
      buildParams(deps.partition, q),
      q.count,
      q.start,
    );
  const search = async (query: FieldSearchQuery): Promise<FieldPage> =>
    runRead(deps.requester, FIELD_DESCRIPTOR.name, readUrl(query), decode);
  // The query is read once, at the first page — mutating it mid-iteration cannot change a later
  // page (RV-32). Same shape as the data resources' `searchAll`.
  const searchAll = (
    query: Omit<FieldSearchQuery, "count" | "start">,
  ): AsyncIterable<Field> =>
    paginateOnce(() => {
      const base = buildParams(deps.partition, query);
      return (count, start) =>
        runRead(
          deps.requester,
          FIELD_DESCRIPTOR.name,
          readUrlOf(deps.accessPoint, "field", base, count, start),
          decode,
        );
    });
  return { search, searchAll };
};
