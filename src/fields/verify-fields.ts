// Comparing a `defineFields` declaration against the tenant it will actually run against
// (ADR-0069 論点5 / 案5c). Reporting is the default; throwing is one extra line.
//
// Why this exists: a declaration that disagrees with the tenant breaks **silently**. Declare a
// text field as `f.option()` (or the reverse) and every read of it returns `null`, which a caller
// cannot tell apart from "the field was empty". ADR-0006 already requires that mismatch to be
// surfaced at runtime (RV-36 covers that half); this is the half that finds it *before* it runs.

import { PortersConfigError } from "../errors";
import type { DataType } from "../porters/data-type";
import { declaredRequired } from "./define-fields";
import type { CustomDataType } from "./custom-data-types";
import type {
  CustomFieldResource,
  DeclaredCatalogs,
} from "./declared-catalogs";
import {
  readCustomCatalog,
  type FieldCatalogSource,
  type TenantCustomCatalog,
  type UndeclarableField,
  type UndeclarableReason,
} from "./read-custom-catalog";

/** Declared, but the tenant has no such field. The read/write request would still ask for it. */
export type MissingField = {
  readonly resource: CustomFieldResource;
  readonly alias: string;
  readonly declared: DataType;
};

/**
 * Declared with a different Data Type than the tenant actually uses. **The worst of the four**:
 * the value silently decodes to `null` (or throws deep in a date conversion), so nothing in the
 * calling code reveals that a field is being read through the wrong type.
 */
export type FieldTypeMismatch = {
  readonly resource: CustomFieldResource;
  readonly alias: string;
  readonly declared: DataType;
  readonly actual: CustomDataType;
};

/** Present in the tenant but not declared. Harmless — it just stays untyped and passes through. */
export type UndeclaredField = {
  readonly resource: CustomFieldResource;
  readonly alias: string;
  readonly actual: CustomDataType;
};

// missing と分ける決定は ADR-0069 論点5。
/**
 * A resource whose catalog could not be read, so **nothing about it was checked**.
 *
 * Kept apart from {@link MissingField} on purpose. Reporting these declarations
 * as "missing" would be a false alarm — and a report that cries wolf stops being read.
 */
export type UnverifiableResource = {
  readonly resource: CustomFieldResource;
  /** Whatever Field Read rejected with (a `PortersError`, typically permission or network). */
  readonly cause: unknown;
};

// 報告だけで ok は倒さない（ADR-0089 案4a）。
/**
 * Declared `required: true` while the tenant does not mark the field required, or the reverse.
 * Harmless either way — reads and writes work — so it does not clear {@link FieldVerification.ok}.
 * `declared: true, tenant: false` is a declaration stricter than the tenant (perhaps on purpose);
 * `declared: false, tenant: true` means `create` will not stop a missing value at compile time.
 */
export type RequiredMismatch = {
  readonly resource: CustomFieldResource;
  readonly alias: string;
  /** Whether the declaration says `required: true`. */
  readonly declared: boolean;
  /** Whether the tenant marks the field required (`Field.P_Required` is `1`). */
  readonly tenant: boolean;
};

/** A tenant field that exists but no declaration can express (carried through from the catalog). */
export type UndeclarableTenantField = UndeclarableField & {
  readonly resource: CustomFieldResource;
};

// 宣言している項目が、テナントでは宣言できない型だった（ADR-0104）。
/**
 * Declared, but the tenant's field is one no declaration can express. `reason` says why:
 * `no-data-type` (the field carries no value of its own, such as Reference) and `not-declarable`
 * (a system-managed field) mean the declaration can never read correctly — every read is `null` —
 * so they clear {@link FieldVerification.ok}. `unknown-field-type` is a type this version of the
 * library does not know; the declaration may well be right, so it is reported without clearing `ok`.
 */
export type DeclaredUndeclarableField = {
  readonly resource: CustomFieldResource;
  readonly alias: string;
  /** The Data Type the declaration gave it. */
  readonly declared: DataType;
  /** `Field.P_Type` exactly as PORTERS returned it; `null` when the field carried none. */
  readonly fieldType: number | null;
  /** PORTERS' own Field Type label, when the value is one it publishes. */
  readonly label?: string;
  readonly reason: UndeclarableReason;
};

/** What {@link verifyFields} found. */
export type FieldVerification = {
  /**
   * `true` when every declared resource was read and nothing needs attention — no
   * {@link FieldVerification.missing}, {@link FieldVerification.typeMismatch},
   * {@link FieldVerification.unverifiable}, and no {@link FieldVerification.declaredUndeclarable}
   * whose reason is `no-data-type` or `not-declarable`.
   *
   * `undeclared`, `undeclarable` and `requiredMismatch` do **not** clear this flag: none of them
   * breaks anything, they are there to be read.
   */
  readonly ok: boolean;
  readonly missing: readonly MissingField[];
  readonly typeMismatch: readonly FieldTypeMismatch[];
  readonly undeclared: readonly UndeclaredField[];
  readonly unverifiable: readonly UnverifiableResource[];
  readonly undeclarable: readonly UndeclarableTenantField[];
  readonly requiredMismatch: readonly RequiredMismatch[];
  readonly declaredUndeclarable: readonly DeclaredUndeclarableField[];
};

/** Options for {@link verifyFields}. */
export type VerifyFieldsOptions = {
  // 既定 -1 は ADR-0069 の accept 時の決定。
  /**
   * Field Read's `active` filter. Defaults to `-1` (every field) and should stay there: with `1`
   * a field that exists but is currently unused is absent from the response, and its declaration
   * would be reported as {@link MissingField} — a false alarm.
   */
  readonly active?: -1 | 0 | 1;
};

// Resource keys actually declared. `Object.keys` on the branded value is fine — the brand is a
// phantom type and never present at runtime (ADR-0023 D2).
const declaredResources = (
  fields: DeclaredCatalogs,
): readonly CustomFieldResource[] =>
  Object.keys(fields) as CustomFieldResource[];

// 宣言できない項目の宣言のうち、ok を倒さないのは「このライブラリが型を知らない」ものだけ（ADR-0104）。
const knownOnlyToBeUnknown = (d: DeclaredUndeclarableField): boolean =>
  d.reason === "unknown-field-type";

// 見つけたものを種類ごとに積む入れ物。`verifyFields` がこれに `ok` を足して返す。
type Findings = {
  missing: MissingField[];
  typeMismatch: FieldTypeMismatch[];
  undeclared: UndeclaredField[];
  unverifiable: UnverifiableResource[];
  undeclarable: UndeclarableTenantField[];
  requiredMismatch: RequiredMismatch[];
  declaredUndeclarable: DeclaredUndeclarableField[];
};

// 宣言した 1 項目を、テナントの項目と突き合わせる。
const compareDeclared = (
  resource: CustomFieldResource,
  alias: string,
  declaredType: DataType,
  declaredReq: boolean,
  actual: TenantCustomCatalog,
  found: Findings,
): void => {
  const actualType = actual.fields[alias];
  if (actualType === undefined) {
    // Not in `actual.fields` — but it may be one of the fields that exists and simply cannot
    // be declared, and calling that "missing" would be wrong. Declaring one of those is its own
    // finding (ADR-0104): it reads as `null` forever, unless the type is merely unknown to us.
    const undeclarable = actual.undeclarable.find((u) => u.alias === alias);
    if (undeclarable === undefined) {
      found.missing.push({ resource, alias, declared: declaredType });
      return;
    }
    found.declaredUndeclarable.push({
      ...undeclarable,
      resource,
      declared: declaredType,
    });
    return;
  }
  if (actualType !== declaredType) {
    found.typeMismatch.push({
      resource,
      alias,
      declared: declaredType,
      actual: actualType,
    });
  }
  const tenantReq = actual.required[alias] === true;
  if (declaredReq !== tenantReq) {
    found.requiredMismatch.push({
      resource,
      alias,
      declared: declaredReq,
      tenant: tenantReq,
    });
  }
};

// 1 リソース分の宣言を、読んだテナントのカタログと突き合わせる。
const compareResource = (
  resource: CustomFieldResource,
  fields: DeclaredCatalogs,
  actual: TenantCustomCatalog,
  found: Findings,
): void => {
  const declared = fields[resource] ?? {};
  const declaredAsRequired = declaredRequired(fields, resource);
  for (const entry of actual.undeclarable) {
    found.undeclarable.push({ ...entry, resource });
  }
  for (const [alias, declaredType] of Object.entries(declared)) {
    compareDeclared(
      resource,
      alias,
      declaredType,
      declaredAsRequired.has(alias),
      actual,
      found,
    );
  }
  for (const [alias, actualType] of Object.entries(actual.fields)) {
    if (declared[alias] === undefined) {
      found.undeclared.push({ resource, alias, actual: actualType });
    }
  }
};

/**
 * Read each declared resource's real catalog and compare it with the declaration.
 *
 * **This does not throw on a mismatch** — it returns what it found. A tenant administrator
 * renaming one field should not stop an application from starting; whether a mismatch is fatal is
 * the caller's call. Pass the result to {@link assertFieldsMatch} to make it fatal.
 *
 * Needs the `field_r` scope. A resource whose Field Read fails lands in
 * {@link FieldVerification.unverifiable} rather than being reported as entirely missing.
 *
 * @example
 * const report = await verifyFields(porters.tenant(1), myFields);
 * if (!report.ok) logger.warn({ report }, "field declarations do not match the tenant");
 */
export const verifyFields = async (
  source: FieldCatalogSource,
  fields: DeclaredCatalogs,
  options: VerifyFieldsOptions = {},
): Promise<FieldVerification> => {
  const found: Findings = {
    missing: [],
    typeMismatch: [],
    undeclared: [],
    unverifiable: [],
    undeclarable: [],
    requiredMismatch: [],
    declaredUndeclarable: [],
  };

  for (const resource of declaredResources(fields)) {
    let actual: TenantCustomCatalog;
    try {
      actual = await readCustomCatalog(source, resource, {
        active: options.active ?? -1,
      });
    } catch (cause) {
      found.unverifiable.push({ resource, cause });
      continue;
    }
    compareResource(resource, fields, actual, found);
  }

  return {
    ok:
      found.missing.length === 0 &&
      found.typeMismatch.length === 0 &&
      found.unverifiable.length === 0 &&
      found.declaredUndeclarable.every(knownOnlyToBeUnknown),
    ...found,
  };
};

// One line per problem, so the thrown message says which field rather than just "some mismatch".
const lines = (report: FieldVerification): readonly string[] => [
  ...report.typeMismatch.map(
    (m) =>
      `${m.resource}.${m.alias}: declared ${m.declared}, tenant has ${m.actual}`,
  ),
  ...report.missing.map(
    (m) =>
      `${m.resource}.${m.alias}: declared ${m.declared}, not in the tenant`,
  ),
  ...report.unverifiable.map(
    (u) =>
      `${u.resource}: could not read the field catalog (${String(u.cause)})`,
  ),
  ...report.declaredUndeclarable
    .filter((d) => !knownOnlyToBeUnknown(d))
    .map(
      (d) =>
        `${d.resource}.${d.alias}: declared ${d.declared}, but the tenant's field cannot be declared (${d.reason})`,
    ),
];

/**
 * Throw unless {@link verifyFields} came back clean — for callers who would rather fail at startup
 * than read a `null` in production.
 *
 * Throws {@link PortersConfigError} (`category: "config"`) for a mismatch, a missing field, a declared
 * field the tenant's type cannot express, **or a resource that could not be read**. That last one is deliberate: "we could not check" is not
 * "everything is fine", and passing it silently would defeat the point of asking.
 *
 * `undeclared` / `undeclarable` / `requiredMismatch` never throw — nothing is broken by any of them.
 *
 * @example
 * assertFieldsMatch(await verifyFields(porters.tenant(1), myFields));
 */
export const assertFieldsMatch = (report: FieldVerification): void => {
  if (report.ok) return;
  const detail = lines(report);
  throw new PortersConfigError(
    `verifyFields: declarations do not match the tenant\n  ${detail.join("\n  ")}`,
    {
      category: "config",
      hint: "Fix the declaration to match the tenant, or regenerate it with generateFieldDecls. A resource listed as unreadable needs the field_r scope.",
    },
  );
};
