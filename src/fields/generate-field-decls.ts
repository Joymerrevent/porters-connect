// Printing a `defineFields` declaration from a tenant's real catalog (ADR-0069 論点1 / 案1b).
//
// Replaces the manual step the guide used to describe: walk Field Read, read `P_Type` off each row,
// look the number up in the Field Type table by hand, and write the matching `f.x()`. The library
// already holds that table, so the translation belongs here.
//
// It returns **source text** and writes no files (ADR-0069 論点2 / Decision Drivers: 薄さ). The
// output goes through `defineFields`, so the declaration it produces is statically typed like any
// hand-written one — which a runtime catalog object could not be (ADR-0004).

import type { FieldBuilder } from "./define-fields";
import { type CustomDataType, type CustomFieldResource } from "./define-fields";
import {
  readCustomCatalog,
  type FieldCatalogSource,
  type TenantCustomCatalog,
  type UndeclarableField,
} from "./tenant-catalog";

/**
 * Which builder method declares each Data Type.
 *
 * Typed as a complete `Record`, so the compiler is the test: a Data Type added to
 * `CUSTOM_DATA_TYPES` without a line here fails to compile, and a method name that is not on
 * {@link FieldBuilder} fails too. Deriving the name by lower-casing would compile happily and then
 * emit `f.uRL()`.
 */
const BUILDER_METHOD: Readonly<Record<CustomDataType, keyof FieldBuilder>> = {
  Number: "number",
  SinglelineText: "singlelineText",
  MultilineText: "multilineText",
  Mail: "mail",
  Telephone: "telephone",
  URL: "url",
  Date: "date",
  DateTime: "dateTime",
  Age: "age",
  Option: "option",
  User: "user",
  Image: "image",
  Link: "link",
};

/** Options for {@link generateFieldDecls}. */
export type GenerateFieldDeclsOptions = {
  /**
   * Field Read's `active` filter. Defaults to `1` — **in-use fields only**, which is what belongs
   * in a template; there is no reason to declare a field the tenant is not using. This is the
   * opposite of `verifyFields`, where narrowing would cause false "missing" reports
   * (ADR-0069, accept 時の決定).
   */
  readonly active?: -1 | 0 | 1;
  /**
   * Add each field's PORTERS name (`Field.P_Name`) as a trailing comment. Off by default: the name
   * is the tenant's own business vocabulary, and generated declarations usually get committed, so
   * opting in should be a deliberate act.
   */
  readonly includeNames?: boolean;
  /** Name of the exported constant. Defaults to `myFields`. */
  readonly constName?: string;
};

/** Why a field appears as a comment instead of a declaration, in words. */
const undeclarableNote = (entry: UndeclarableField): string => {
  const type =
    entry.label === undefined
      ? `Field Type ${String(entry.fieldType)}`
      : `${entry.label} (Field Type ${String(entry.fieldType)})`;
  if (entry.reason === "unknown-field-type") {
    return `${type} is not in PORTERS' published Field Type list — this library cannot declare it yet`;
  }
  if (entry.reason === "no-data-type") {
    return `${type} carries no value of its own, so there is nothing to declare`;
  }
  return `${type} is system-managed — standard fields cover it, custom declarations do not`;
};

// One resource's block. Sorted by alias so regenerating produces the same text rather than
// reshuffling a committed file.
const resourceBlock = (
  catalog: TenantCustomCatalog,
  includeNames: boolean,
): string => {
  const entries = Object.entries(catalog.fields).sort(([a], [b]) =>
    a < b ? -1 : 1,
  );
  const declarations = entries.map(([alias, dataType]) => {
    const name = includeNames ? catalog.names[alias] : undefined;
    const comment = name === undefined ? "" : ` // ${name}`;
    return `    ${alias}: f.${BUILDER_METHOD[dataType]}(),${comment}`;
  });
  const notes = [...catalog.undeclarable]
    .sort((a, b) => (a.alias < b.alias ? -1 : 1))
    .map((entry) => `    // ${entry.alias}: ${undeclarableNote(entry)}`);
  const body = [...declarations, ...notes];
  // No declarable fields means the builder argument would be unused, which trips a lint rule in
  // the consuming project — so emit the parameterless form.
  const param = declarations.length === 0 ? "()" : "(f)";
  return body.length === 0
    ? `  ${catalog.resource}: ${param} => ({}),`
    : `  ${catalog.resource}: ${param} => ({\n${body.join("\n")}\n  }),`;
};

/**
 * Read the given resources' custom fields and print a `defineFields` call for them.
 *
 * Fields whose Field Type cannot be declared are emitted as **comments** rather than dropped
 * (ADR-0069 論点4), so a tenant field the library cannot yet express is visible in the output
 * instead of silently absent.
 *
 * Writing the result to a file is the caller's job — this library does not touch the filesystem.
 *
 * @example
 * import { writeFile } from "node:fs/promises";
 *
 * const src = await generateFieldDecls(porters.tenant(1), ["candidate", "job"]);
 * await writeFile("src/porters-fields.ts", src);
 */
export const generateFieldDecls = async (
  source: FieldCatalogSource,
  resources: readonly CustomFieldResource[],
  options: GenerateFieldDeclsOptions = {},
): Promise<string> => {
  const active = options.active ?? 1;
  const includeNames = options.includeNames ?? false;
  const constName = options.constName ?? "myFields";

  const blocks: string[] = [];
  for (const resource of resources) {
    // One read per resource: the catalog already carries `P_Name` for each field, so asking for
    // names costs no extra round trip.
    const catalog = await readCustomCatalog(source, resource, { active });
    blocks.push(resourceBlock(catalog, includeNames));
  }

  return [
    "// Generated by generateFieldDecls (@joymerrevent/porters-connect).",
    "// Re-run it when the tenant's fields change, and check the result with verifyFields.",
    'import { defineFields } from "@joymerrevent/porters-connect";',
    "",
    `export const ${constName} = defineFields({`,
    ...blocks,
    "});",
    "",
  ].join("\n");
};
