// Custom field declaration DSL (ADR-0023, grounding ADR-0004 案H / ADR-0005 SD-2).
// `defineFields` is the single validation boundary: a typed builder declares each
// tenant custom field's Data Type per data resource, validation runs synchronously,
// and the result is branded so `tenant(id, { fields })` trusts it without re-validating. Standard
// `P_` fields come from the static catalogs (ADR-0019); this only covers custom U_/A_.

import { PortersConfigError } from "../errors";
import { CUSTOM_ALIAS_PATTERN } from "../porters/custom-field";
import type {
  CustomCatalog,
  CustomFieldResource,
  DeclaredCatalogs,
  DeclaredCatalogsOf,
  DeclaredRequiredOf,
  DefinedFields,
  FieldBuilder,
  FieldDecls,
  FieldDef,
  FieldOptions,
} from "./declared-catalogs";
import type { CustomDataType } from "./custom-data-types";

// 全 arrow（ADR-0013）＝巻き上げ無しのため、ヘルパー → builder → defineFields の順で定義する。
// Only a literal `true` makes a field required; anything else (absent, `false`) leaves it optional —
// the behaviour every declaration had before `required` existed. A non-boolean is rejected by
// `defineFields` below, so a JS caller writing `required: "yes"` hears about it.
const def =
  <D extends CustomDataType>(dataType: D) =>
  <R extends boolean = false>(options?: FieldOptions<R>): FieldDef<D, R> =>
    ({ dataType, required: options?.required === true }) as FieldDef<D, R>;

export const builder: FieldBuilder = {
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
