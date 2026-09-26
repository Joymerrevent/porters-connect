// What a custom field declaration looks like, and the types derived from it (ADR-0023 / ADR-0089):
// the catalog each resource declares, which aliases `create` requires, and the brand that marks a
// declaration as validated by `defineFields`. Types only — `defineFields` builds the value.

import type { EmptyCatalog } from "../accessor/catalog";
import type { DataType } from "../porters/data-type";

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
