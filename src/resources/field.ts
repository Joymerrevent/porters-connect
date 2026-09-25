// Field master accessor (read-only — ADR-0021/0022). Field Read introspects a resource's
// field catalog (standard `P_` + tenant `U_`/`A_`). It requires `partition` and `resource`
// (a resource-type Value code), plus optional `active`. No `field`/`condition`/`get(id)`.
//
// `resource` is a **URL parameter PORTERS requires**, so it is bound once by `of(name)` rather
// than repeated in every query (ADR-0080) — the same shape as `t.phase.of(name)`. The accessor
// then reads like any other: `t.field.of("candidate").search()`.
// `P_ReferTo` is a nested alias (the option group for Option-type fields, the parent field for
// Reference-type) — decoded like an Option value to the referenced alias(es) (ADR-0022).

import type { ResourceDeps } from "./core/read";
import type { ResourceDescriptor } from "./core/descriptor";
import {
  type FieldCatalog,
  type Paging,
  type ReadRecord,
  type ResourcePage,
} from "./core/read";
import { RESOURCE_VALUES, type ResourceName } from "../porters/resource-list";
import { createMasterResource } from "./core/master-resource";

// 別テーブルを持たず alias にしたのは、独自コピーが Process を落としていた RV-37 の再発防止。
/**
 * A resource whose field catalog can be read (Field Read `resource` selector).
 *
 * Field Read takes a Resource List Value, so the selectable set **is** the set PORTERS gives a
 * Value — the same one `t.phase.of()` accepts. This is an alias rather than a second table on
 * purpose: a separate copy once silently lost a resource, so the Value table lives in one place
 * and both roles read from it.
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

// resource を of(name) で束ねる形は ADR-0080。
/** Field Read query. The resource itself is bound by `of(name)`. */
export type FieldSearchQuery = {
  /** -1 = all (default), 0 = unused only, 1 = in-use only. */
  active?: -1 | 0 | 1;
};

/** The Field accessor for one bound resource. */
export type FieldResource = {
  search(query?: FieldSearchQuery & Paging): Promise<FieldPage>;
  /** Auto-paginating search: yields every field of the resource. */
  searchAll(query?: FieldSearchQuery): AsyncIterable<Field>;
};

// of(resource) で束ねる形は ADR-0080。
/**
 * Field Read is reached through the resource whose catalog you want:
 *
 * ```ts
 * const fields = t.field.of("candidate");
 * for await (const f of fields.searchAll({ active: 1 })) console.log(f.P_Alias);
 * ```
 *
 * The name is the accessor's own spelling ({@link ResourceName}) — `of(1)` and `of("candidat")`
 * are compile errors. PORTERS requires the `resource=` parameter on every Field Read, so binding
 * it once means it cannot be forgotten or contradicted.
 */
export type FieldAccessor = {
  of(resource: ResourceType): FieldResource;
};

// The parameters Field Read takes; paging and sending are the shared `createMasterResource`.
const buildParams = (
  partition: number,
  resource: ResourceType,
  q: FieldSearchQuery,
): URLSearchParams => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  p.set("resource", String(RESOURCE_VALUES[resource]));
  p.set("active", String(q.active ?? -1));
  return p;
};

export const createFieldAccessor = (deps: ResourceDeps): FieldAccessor => ({
  of: (resource) =>
    createMasterResource(
      {
        ...FIELD_DESCRIPTOR,
        params: (q: FieldSearchQuery) =>
          buildParams(deps.partition, resource, q),
      },
      deps,
    ),
});
