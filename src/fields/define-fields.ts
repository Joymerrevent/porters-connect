// Custom field declaration DSL (ADR-0023, grounding ADR-0004 案H / ADR-0005 SD-2).
// `defineFields` is the single validation boundary: a typed builder declares each
// tenant custom field's Data Type per data resource, validation runs synchronously,
// and the result is branded so `tenant(id, { fields })` trusts it without re-validating. Standard
// `P_` fields come from the static catalogs (ADR-0019); this only covers custom U_/A_.

import { PortersConfigError } from "../errors";
import type { EmptyCatalog } from "../resources/core/catalog";
import type { DataType } from "../porters/data-type";
import { CUSTOM_ALIAS_PATTERN } from "../porters/custom-field";

// ADR-0023 D2。必須（required）は ADR-0089。
/**
 * One custom field's declaration — the builder's return value: its Data Type and whether
 * `create` requires it.
 */
export type FieldDef<D extends DataType, R extends boolean = false> = {
  readonly dataType: D;
  /** `true` makes the field required in `create` / `createMany` input. Type-only: no runtime check. */
  readonly required: R;
};

// 必須は宣言で明示したときだけ（opt-in・ADR-0089 案1a / 案2a）。
/**
 * Options every builder method takes. `required: true` makes the field required in the
 * `create` / `createMany` input type; leave it out (or `false`) and the field stays optional,
 * as it always was. `update` input never requires it.
 *
 * @example
 * defineFields({ candidate: (f) => ({ U_score: f.number({ required: true }) }) });
 */
export type FieldOptions<R extends boolean = boolean> = {
  readonly required?: R;
};

// Data Types a custom U_/A_ field may declare (ADR-0023 D3): the value-shaped types. The
// System family (System[Id]/[DateTime]/[Reference]) is system-managed = standard territory,
// so it is not offered. Image / Link are here (ADR-0064 案5a) and **only** here: no standard
// field carries either type, so declaring one is the only way a tenant's image / link field
// can be read or written at all.
export const CUSTOM_DATA_TYPES = [
  "Number",
  "SinglelineText",
  "MultilineText",
  "Mail",
  "Telephone",
  "URL",
  "Date",
  "DateTime",
  "Age",
  "Option",
  "User",
  "Image",
  "Link",
] as const satisfies readonly DataType[];

export type CustomDataType = (typeof CUSTOM_DATA_TYPES)[number];

/** Builder passed to each resource declaration: one method per declarable Data Type. */
export type FieldBuilder = {
  number<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"Number", NoInfer<R>>;
  singlelineText<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"SinglelineText", NoInfer<R>>;
  multilineText<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"MultilineText", NoInfer<R>>;
  mail<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"Mail", NoInfer<R>>;
  telephone<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"Telephone", NoInfer<R>>;
  url<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"URL", NoInfer<R>>;
  date<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"Date", NoInfer<R>>;
  dateTime<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"DateTime", NoInfer<R>>;
  age<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"Age", NoInfer<R>>;
  option<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"Option", NoInfer<R>>;
  user<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"User", NoInfer<R>>;
  /**
   * An Image field (FT-18). Reads back `FileName` alone unless the query's `image` option asks
   * for `ContentType` / `Content`; writes the three sub-elements, checked before send.
   */
  image<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"Image", NoInfer<R>>;
  /**
   * A Link field (FT-20). Reads back a Contact id, a `UserRef`, or a `DepartmentRef` — whichever
   * the tenant configured, told apart by shape; writes the referenced id.
   */
  link<R extends boolean = false>(
    options?: FieldOptions<R>,
  ): FieldDef<"Link", NoInfer<R>>;
};

// ADR-0023 D6。
/** Data resources that accept custom fields. Master / Attachment are excluded. */
export type CustomFieldResource =
  | "candidate"
  | "job"
  | "client"
  | "recruiter"
  | "contact"
  | "opportunity"
  | "activity"
  | "contract"
  | "sales"
  | "process"
  | "resume";

/** One resource's custom field declarations: alias -> {@link FieldDef}. */
export type ResourceDecl = Record<string, FieldDef<DataType, boolean>>;

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

// The aliases of one resource's FieldDef map declared with `required: true`.
type RequiredAliasesOf<R extends ResourceDecl> = {
  [K in keyof R]: R[K]["required"] extends true ? K : never;
}[keyof R];

// 型だけの印（実行時には存在しない）。宣言の必須を tenant(id, { fields }) の型まで運ぶ（ADR-0089）。
// 項目表（alias -> Data Type）の形を変えずに載せるため、リソース名でなくシンボルのキーに置く。
declare const requiredOnCreateBrand: unique symbol;

/** Per declared resource, the aliases declared `required: true` — carried on the type only. */
export type DeclaredRequiredOf<D extends FieldDecls> = {
  readonly [requiredOnCreateBrand]: {
    [R in keyof D]: D[R] extends (f: FieldBuilder) => infer Out
      ? Out extends ResourceDecl
        ? RequiredAliasesOf<Out>
        : never
      : never;
  };
};

// Phantom brand: marks a catalog set as already validated by defineFields (ADR-0023 D4).
// It never exists at runtime — the value is a plain frozen object.
declare const definedFieldsBrand: unique symbol;

/** A validated set of custom field catalogs (branded — the client does not re-validate). */
export type DefinedFields<C extends DeclaredCatalogs = DeclaredCatalogs> = C & {
  readonly [definedFieldsBrand]: true;
};

// ADR-0023 D1。
/** The custom catalog declared for resource `K` (or `{}` if none) — types each accessor. */
export type CustomFor<
  C extends DeclaredCatalogs,
  K extends CustomFieldResource,
> = K extends keyof C
  ? C[K] extends CustomCatalog
    ? C[K]
    : EmptyCatalog
  : EmptyCatalog;

// ADR-0023 D1 / ADR-0089。
/**
 * The aliases of resource `K` that `create` requires because the declaration said
 * `required: true` (or `never`). Read off the phantom that {@link defineFields} puts on its
 * result type, so a scope typed `TenantScope<typeof fields>` picks it up with no extra type argument.
 */
export type RequiredFor<
  C extends DeclaredCatalogs,
  K extends CustomFieldResource,
> = C extends { readonly [requiredOnCreateBrand]: infer Rq }
  ? K extends keyof Rq
    ? Extract<Rq[K], keyof CustomFor<C, K>>
    : never
  : never;

// 全 arrow（ADR-0013）＝巻き上げ無しのため、ヘルパー → builder → defineFields の順で定義する。
// Only a literal `true` makes a field required; anything else (absent, `false`) leaves it optional —
// the behaviour every declaration had before `required` existed. A non-boolean is rejected by
// `defineFields` below, so a JS caller writing `required: "yes"` hears about it.
const def =
  <D extends CustomDataType>(dataType: D) =>
  <R extends boolean = false>(options?: FieldOptions<R>): FieldDef<D, R> =>
    ({ dataType, required: options?.required === true }) as FieldDef<D, R>;

const builder: FieldBuilder = {
  number: def("Number"),
  singlelineText: def("SinglelineText"),
  multilineText: def("MultilineText"),
  mail: def("Mail"),
  telephone: def("Telephone"),
  url: def("URL"),
  date: def("Date"),
  dateTime: def("DateTime"),
  age: def("Age"),
  option: def("Option"),
  user: def("User"),
  image: def("Image"),
  link: def("Link"),
};

// 実行時の必須の置き場（ADR-0089「宣言の実行時の値にも必須を残す」）。verifyFields が読む。
// リソースに合流させる項目表には混ぜない＝読み書きの経路は必須を知らない。
// Object.entries / Object.keys はシンボルのキーを数えないので、宣言を列挙する既存のコードに見えない。
const REQUIRED_ON_CREATE = Symbol("porters.requiredOnCreate");

type RuntimeRequired = Readonly<Record<string, readonly string[]>>;

/**
 * The aliases of `resource` declared `required: true` in `fields`. Internal — for `verifyFields`;
 * not part of the published API. A declaration that did not come from {@link defineFields}
 * (or lost the marker by being copied) reads as "none required".
 */
export const declaredRequired = (
  fields: DeclaredCatalogs,
  resource: CustomFieldResource,
): ReadonlySet<string> => {
  const marker = (fields as { [REQUIRED_ON_CREATE]?: RuntimeRequired })[
    REQUIRED_ON_CREATE
  ];
  return new Set(marker?.[resource] ?? []);
};

const KNOWN_RESOURCES: readonly CustomFieldResource[] = [
  "candidate",
  "job",
  "client",
  "recruiter",
  "contact",
  "opportunity",
  "activity",
  "contract",
  "sales",
  "process",
  "resume",
];

// 宣言 DSL は ADR-0023、渡し先が tenant(id, { fields }) なのは ADR-0087。
/**
 * Declare tenant-specific custom fields per data resource. This is the validation
 * boundary: it throws {@link PortersConfigError} synchronously for an unknown resource key or an
 * alias that is not `U_`/`A_`-prefixed. The branded result is passed to the partition it describes,
 * `porters.tenant(id, { fields })`, which merges each catalog into the resource so the
 * custom fields decode/encode by their declared Data Type and appear typed on reads / writes.
 *
 * @example
 * const myFields = defineFields({
 *   candidate: (f) => ({ U_score: f.number(), U_source: f.option() }),
 * });
 * const t = porters.tenant(1, { fields: myFields });
 */
export const defineFields = <D extends FieldDecls>(
  decls: D,
): DefinedFields<DeclaredCatalogsOf<D> & DeclaredRequiredOf<D>> => {
  const catalogs: Record<string, CustomCatalog> = {};
  const required: Record<string, string[]> = {};
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
      if (!CUSTOM_ALIAS_PATTERN.test(alias)) {
        throw new PortersConfigError(
          `defineFields: custom field alias "${alias}" on "${resource}" must start with "U_" or "A_" (standard P_ fields are built in)`,
          { category: "config" },
        );
      }
      catalog[alias] = fieldDef.dataType;
      // JS から呼ばれたときの取り違え（"true" など）を黙って任意にしない。
      const flag: unknown = (fieldDef as { required?: unknown }).required;
      if (flag !== undefined && typeof flag !== "boolean") {
        throw new PortersConfigError(
          `defineFields: "required" for "${alias}" on "${resource}" must be true or false`,
          { category: "config" },
        );
      }
      if (flag === true) (required[resource] ??= []).push(alias);
    }
    catalogs[resource] = catalog;
  }
  Object.defineProperty(catalogs, REQUIRED_ON_CREATE, {
    value: Object.freeze(required),
  });
  return Object.freeze(catalogs) as DefinedFields<
    DeclaredCatalogsOf<D> & DeclaredRequiredOf<D>
  >;
};
