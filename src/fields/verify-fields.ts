// Comparing a `defineFields` declaration against the tenant it will actually run against
// (ADR-0069 論点5 / 案5c). Reporting is the default; throwing is one extra line.
//
// Why this exists: a declaration that disagrees with the tenant breaks **silently**. Declare a
// text field as `f.option()` (or the reverse) and every read of it returns `null`, which a caller
// cannot tell apart from "the field was empty". ADR-0006 already requires that mismatch to be
// surfaced at runtime (RV-36 covers that half); this is the half that finds it *before* it runs.

import { PortersConfigError } from "../errors";
import type { DataType } from "../porters/data-type";
import {
  declaredRequired,
  type CustomDataType,
  type CustomFieldResource,
  type DeclaredCatalogs,
} from "./define-fields";
import {
  readCustomCatalog,
  type FieldCatalogSource,
  type UndeclarableField,
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

/** What {@link verifyFields} found. */
export type FieldVerification = {
  /**
   * `true` when every declared resource was read and nothing needs attention — no
   * {@link FieldVerification.missing}, {@link FieldVerification.typeMismatch} or
   * {@link FieldVerification.unverifiable}.
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
  const missing: MissingField[] = [];
  const typeMismatch: FieldTypeMismatch[] = [];
  const undeclared: UndeclaredField[] = [];
  const unverifiable: UnverifiableResource[] = [];
  const undeclarable: UndeclarableTenantField[] = [];
  const requiredMismatch: RequiredMismatch[] = [];

  for (const resource of declaredResources(fields)) {
    const declared = fields[resource] ?? {};
    const declaredAsRequired = declaredRequired(fields, resource);
    let actual;
    try {
      actual = await readCustomCatalog(source, resource, {
        active: options.active ?? -1,
      });
    } catch (cause) {
      unverifiable.push({ resource, cause });
      continue;
    }
    for (const entry of actual.undeclarable) {
      undeclarable.push({ ...entry, resource });
    }
    for (const [alias, declaredType] of Object.entries(declared)) {
      const actualType = actual.fields[alias];
      if (actualType === undefined) {
        // Not in `actual.fields` — but it may be one of the fields that exists and simply cannot
        // be declared, and calling that "missing" would be wrong.
        const undeclarableHere = actual.undeclarable.some(
          (u) => u.alias === alias,
        );
        if (!undeclarableHere) {
          missing.push({ resource, alias, declared: declaredType });
        }
        continue;
      }
      if (actualType !== declaredType) {
        typeMismatch.push({
          resource,
          alias,
          declared: declaredType,
          actual: actualType,
        });
      }
      const declaredReq = declaredAsRequired.has(alias);
      const tenantReq = actual.required[alias] === true;
      if (declaredReq !== tenantReq) {
        requiredMismatch.push({
          resource,
          alias,
          declared: declaredReq,
          tenant: tenantReq,
        });
      }
    }
    for (const [alias, actualType] of Object.entries(actual.fields)) {
      if (declared[alias] === undefined) {
        undeclared.push({ resource, alias, actual: actualType });
      }
    }
  }

  return {
    ok:
      missing.length === 0 &&
      typeMismatch.length === 0 &&
      unverifiable.length === 0,
    missing,
    typeMismatch,
    undeclared,
    unverifiable,
    undeclarable,
    requiredMismatch,
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
];

/**
 * Throw unless {@link verifyFields} came back clean — for callers who would rather fail at startup
 * than read a `null` in production.
 *
 * Throws {@link PortersConfigError} (`category: "config"`) for a mismatch, a missing field, **or a
 * resource that could not be read**. That last one is deliberate: "we could not check" is not
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
