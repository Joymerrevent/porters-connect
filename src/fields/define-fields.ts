// Custom field declaration DSL (ADR-0023, grounding ADR-0004 案H / ADR-0005 SD-2).
// `defineFields` is the single validation boundary: a typed builder declares each
// tenant custom field's Data Type per data resource, validation runs synchronously,
// and the result is branded so PortersClient trusts it without re-validating. Standard
// `P_` fields come from the static catalogs (ADR-0019); this only covers custom U_/A_.

import { PortersConfigError } from "../errors";
import type { EmptyCatalog } from "../resources/read-core";
import type { DataType } from "../xml/decode";

/** One custom field's declared Data Type — the builder's return value (ADR-0023 D2). */
export type FieldDef<D extends DataType> = { readonly dataType: D };

// Data Types a custom U_/A_ field may declare (ADR-0023 D3): the value-shaped types. The
// System family (System[Id]/[DateTime]/[Reference]) is system-managed = standard territory,
// so it is not offered; Image / Link are not modelled in DataType yet (future work).
export type CustomDataType =
  | "Number"
  | "SinglelineText"
  | "MultilineText"
  | "Mail"
  | "Telephone"
  | "URL"
  | "Date"
  | "DateTime"
  | "Age"
  | "Option"
  | "User";

/** Builder passed to each resource declaration: one method per declarable Data Type. */
export type FieldBuilder = {
  number(): FieldDef<"Number">;
  singlelineText(): FieldDef<"SinglelineText">;
  multilineText(): FieldDef<"MultilineText">;
  mail(): FieldDef<"Mail">;
  telephone(): FieldDef<"Telephone">;
  url(): FieldDef<"URL">;
  date(): FieldDef<"Date">;
  dateTime(): FieldDef<"DateTime">;
  age(): FieldDef<"Age">;
  option(): FieldDef<"Option">;
  user(): FieldDef<"User">;
};

/** Data resources that accept custom fields (ADR-0023 D6). Master / Attachment are excluded. */
export type CustomFieldResource =
  | "candidate"
  | "job"
  | "client"
  | "process"
  | "resume";

/** One resource's custom field declarations: alias -> {@link FieldDef}. */
export type ResourceDecl = Record<string, FieldDef<DataType>>;

/** Declaration input: per (data) resource, a builder fn returning its custom fields. */
export type FieldDecls = {
  [R in CustomFieldResource]?: (f: FieldBuilder) => ResourceDecl;
};

/** A per-resource custom catalog (bare alias -> Data Type), as produced by {@link defineFields}. */
export type CustomCatalog = Record<string, DataType>;

/** Map of (data) resource -> its custom catalog; the client merges these into the static catalogs. */
export type DeclaredCatalogs = {
  [R in CustomFieldResource]?: CustomCatalog;
};

// Extract the catalog (alias -> Data Type literal) from a resource's FieldDef map.
type CatalogOf<R extends ResourceDecl> = {
  [K in keyof R]: R[K]["dataType"];
};

/** The validated, branded result of {@link defineFields}, keyed by the declared resources. */
export type DeclaredCatalogsOf<D extends FieldDecls> = {
  [R in keyof D]: D[R] extends (f: FieldBuilder) => infer Out
    ? Out extends ResourceDecl
      ? CatalogOf<Out>
      : never
    : never;
};

// Phantom brand: marks a catalog set as already validated by defineFields (ADR-0023 D4).
// It never exists at runtime — the value is a plain frozen object.
declare const definedFieldsBrand: unique symbol;

/** A validated set of custom field catalogs (branded — the client does not re-validate). */
export type DefinedFields<C extends DeclaredCatalogs = DeclaredCatalogs> = C & {
  readonly [definedFieldsBrand]: true;
};

/** The custom catalog declared for resource `K` (or `{}` if none) — types each accessor (ADR-0023 D1). */
export type CustomFor<
  C extends DeclaredCatalogs,
  K extends CustomFieldResource,
> = K extends keyof C
  ? C[K] extends CustomCatalog
    ? C[K]
    : EmptyCatalog
  : EmptyCatalog;

// 全 arrow（ADR-0013）＝巻き上げ無しのため、ヘルパー → builder → defineFields の順で定義する。
const def = <D extends CustomDataType>(dataType: D): FieldDef<D> => ({
  dataType,
});

const builder: FieldBuilder = {
  number: () => def("Number"),
  singlelineText: () => def("SinglelineText"),
  multilineText: () => def("MultilineText"),
  mail: () => def("Mail"),
  telephone: () => def("Telephone"),
  url: () => def("URL"),
  date: () => def("Date"),
  dateTime: () => def("DateTime"),
  age: () => def("Age"),
  option: () => def("Option"),
  user: () => def("User"),
};

// Custom field aliases are `U_[Name]` (user-created) or `A_[Name]` (app-created) — ADR-0004.
const ALIAS_PATTERN = /^[UA]_/;

const KNOWN_RESOURCES: readonly CustomFieldResource[] = [
  "candidate",
  "job",
  "client",
  "process",
  "resume",
];

/**
 * Declare tenant-specific custom fields per data resource (ADR-0023). This is the validation
 * boundary: it throws {@link PortersConfigError} synchronously for an unknown resource key or an
 * alias that is not `U_`/`A_`-prefixed. The branded result is passed to `PortersClient({ fields })`,
 * which merges each catalog into the resource so the custom fields decode/encode by their declared
 * Data Type and appear typed on reads / writes.
 *
 * @example
 * const myFields = defineFields({
 *   candidate: (f) => ({ U_score: f.number(), U_source: f.option() }),
 * });
 */
export const defineFields = <D extends FieldDecls>(
  decls: D,
): DefinedFields<DeclaredCatalogsOf<D>> => {
  const catalogs: Record<string, CustomCatalog> = {};
  for (const [resource, declare] of Object.entries(decls)) {
    if (declare === undefined) continue;
    if (!KNOWN_RESOURCES.includes(resource as CustomFieldResource)) {
      throw new PortersConfigError(
        `defineFields: unknown resource "${resource}" (expected one of ${KNOWN_RESOURCES.join(", ")})`,
        { category: "config" },
      );
    }
    const catalog: CustomCatalog = {};
    for (const [alias, fieldDef] of Object.entries(declare(builder))) {
      if (!ALIAS_PATTERN.test(alias)) {
        throw new PortersConfigError(
          `defineFields: custom field alias "${alias}" on "${resource}" must start with "U_" or "A_" (standard P_ fields are built in)`,
          { category: "config" },
        );
      }
      catalog[alias] = fieldDef.dataType;
    }
    catalogs[resource] = catalog;
  }
  return Object.freeze(catalogs) as DefinedFields<DeclaredCatalogsOf<D>>;
};
