// Reading a tenant's actual custom fields from Field Read (ADR-0069 論点1 / 案1b).
//
// This is the primitive both consumers sit on: `verifyFields` compares it against a declaration
// and `generateFieldDecls` prints one from it. Keeping the Field Read quirks — the alias prefix,
// Field Types that cannot be declared, paging — in one place is the whole point of 案1b.
//
// Direction note: `fields/` may import `resources/`, never the other way round (RV-8).

import { dataTypeOfFieldType, fieldTypeLabel } from "../resources/field-type";
import type { Field, FieldSearchQuery } from "../resources/field";
import { bareAlias } from "../resources/read-core";
import type { DataType } from "../xml/decode";
import {
  CUSTOM_DATA_TYPES,
  type CustomDataType,
  type CustomFieldResource,
} from "./define-fields";

/**
 * The slice of a `tenant(id)` scope this tooling needs. Structural on purpose: pass
 * `porters.tenant(1)` and it fits, but a test can hand over just a `field` stub.
 */
export type FieldCatalogSource = {
  readonly field: {
    searchAll(
      query: Omit<FieldSearchQuery, "count" | "start">,
    ): AsyncIterable<Field>;
  };
};

/** Why a tenant custom field cannot be expressed as a declaration (ADR-0069 論点4). */
export type UndeclarableReason =
  /** `Field.P_Type` is not in PORTERS' published list — a type added since (report, never drop). */
  | "unknown-field-type"
  /** A published type that carries no value of its own (16 Reference). */
  | "no-data-type"
  /** System-managed, i.e. standard-field territory — not offered by the builder (ADR-0023 D3). */
  | "not-declarable";

/** A custom field PORTERS reports that no `defineFields` declaration can express. */
export type UndeclarableField = {
  /** The bare alias (prefix stripped), e.g. `U_legacy`. */
  readonly alias: string;
  /** `Field.P_Type` exactly as PORTERS returned it; `null` when the field carried none. */
  readonly fieldType: number | null;
  /** PORTERS' own Field Type label, when the value is one it publishes. */
  readonly label?: string;
  readonly reason: UndeclarableReason;
};

/** One resource's custom fields as the tenant actually has them. */
export type TenantCustomCatalog = {
  readonly resource: CustomFieldResource;
  /**
   * Bare alias -> declared Data Type — the same shape `defineFields` produces, so it compares
   * directly against a declaration.
   */
  readonly fields: Readonly<Record<string, CustomDataType>>;
  /**
   * Custom fields that exist but cannot be declared. **Never silently dropped** (ADR-0069 論点4):
   * an unknown Field Type means PORTERS grew a type, and nobody would notice if it vanished here.
   */
  readonly undeclarable: readonly UndeclarableField[];
  /**
   * Bare alias -> `Field.P_Name`, for every custom field seen (declarable or not).
   *
   * Collected while the rows go past so nothing needs a second round trip. This is the **tenant's
   * own business vocabulary**, so it is carried but never printed unless a caller explicitly asks
   * (`generateFieldDecls` has it off by default). A field PORTERS returned without a name is absent.
   */
  readonly names: Readonly<Record<string, string>>;
};

/** Options for {@link readCustomCatalog}. */
export type ReadCustomCatalogOptions = {
  /**
   * Field Read's `active` filter: `-1` all (default), `0` unused only, `1` in-use only.
   *
   * The default is `-1` deliberately. Narrowing to `1` would hide fields that exist but are
   * unused, and a comparison against a declaration would then report them as **missing** — a
   * false alarm. `generateFieldDecls` overrides it to `1`, where "only what is in use" is what
   * you want in a template (ADR-0069, accept 時の決定).
   */
  readonly active?: -1 | 0 | 1;
};

const DECLARABLE: ReadonlySet<DataType> = new Set<DataType>(CUSTOM_DATA_TYPES);

// A type guard rather than a bare `has`, so the declarable branch narrows without a cast.
const isDeclarable = (dataType: DataType): dataType is CustomDataType =>
  DECLARABLE.has(dataType);

// Custom aliases are `U_[Name]` / `A_[Name]` (ADR-0004); everything else is a standard field.
const CUSTOM_ALIAS = /^[UA]_/;

// Field Read's `P_Alias` may arrive qualified (`Person.U_score`) or bare (`U_score`) — which one
// is unconfirmed (ADR-0069 論点7 / 案7a). `bareAlias` (read-core) already handles both, and it also
// absorbs Candidate's prefix being `Person` rather than the resource name, so it is reused rather
// than reimplemented.
//
// VERIFY(live): the qualified-vs-bare question is docs/live-verification.md (LV-12). Handling both
// is the fail-safe side: expecting a bare alias and receiving `Person.U_score` would match nothing
// and report the tenant as having **no** custom fields — indistinguishable from "could not read it".

// One Field Read row -> either a declarable (alias, Data Type) pair or a reason it is not one.
const classify = (
  alias: string,
  fieldType: number | null,
):
  | { readonly kind: "declarable"; readonly dataType: CustomDataType }
  | { readonly kind: "undeclarable"; readonly entry: UndeclarableField } => {
  // A row with no Field Type at all: PORTERS gave us nothing to map, so we invent nothing.
  if (fieldType === null) {
    return {
      kind: "undeclarable",
      entry: { alias, fieldType, reason: "unknown-field-type" },
    };
  }
  const label = fieldTypeLabel(fieldType);
  const dataType = dataTypeOfFieldType(fieldType);
  if (dataType === undefined) {
    return {
      kind: "undeclarable",
      entry: { alias, fieldType, reason: "unknown-field-type" },
    };
  }
  if (dataType === null) {
    return {
      kind: "undeclarable",
      entry: { alias, fieldType, label, reason: "no-data-type" },
    };
  }
  if (!isDeclarable(dataType)) {
    return {
      kind: "undeclarable",
      entry: { alias, fieldType, label, reason: "not-declarable" },
    };
  }
  return { kind: "declarable", dataType };
};

/**
 * Read one resource's tenant custom fields (`U_` / `A_`) from Field Read.
 *
 * Standard `P_` fields are left out — they are the static catalogs' job (ADR-0019) and declaring
 * one is rejected by `defineFields` anyway. Fields whose Field Type cannot become a declaration
 * come back under `undeclarable` rather than being dropped.
 *
 * @example
 * const catalog = await readCustomCatalog(porters.tenant(1), "candidate");
 * catalog.fields; // { U_score: "Number", U_source: "Option" }
 */
export const readCustomCatalog = async (
  source: FieldCatalogSource,
  resource: CustomFieldResource,
  options: ReadCustomCatalogOptions = {},
): Promise<TenantCustomCatalog> => {
  const fields: Record<string, CustomDataType> = {};
  const undeclarable: UndeclarableField[] = [];
  const names: Record<string, string> = {};
  for await (const row of source.field.searchAll({
    resource,
    active: options.active ?? -1,
  })) {
    // Every `ReadRecord` field is optional, and a null/absent alias cannot be matched to
    // anything — there is nothing to report about it either, so it is the one case that is
    // simply not a custom field.
    if (row.P_Alias === null || row.P_Alias === undefined) continue;
    const alias = bareAlias(row.P_Alias);
    if (!CUSTOM_ALIAS.test(alias)) continue;
    if (row.P_Name !== null && row.P_Name !== undefined)
      names[alias] = row.P_Name;
    const result = classify(alias, row.P_Type ?? null);
    if (result.kind === "declarable") fields[alias] = result.dataType;
    else undeclarable.push(result.entry);
  }
  return { resource, fields, undeclarable, names };
};
