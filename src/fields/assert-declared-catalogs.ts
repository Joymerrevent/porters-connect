// Checking a custom field declaration at run time: the resource is one that takes custom fields, each
// alias is `U_` / `A_`, and each Data Type is one a custom field can have. `defineFields` checks field by
// field as it builds; `tenant()` checks a whole declaration it was handed, since the brand that marks a
// declaration as checked is only a type — a plain object or a JS caller gets past it (RV-79).

import { PortersConfigError } from "../errors";
import { CUSTOM_ALIAS_PATTERN } from "../porters/custom-field";
import { CUSTOM_DATA_TYPES } from "./custom-data-types";
import type { CustomFieldResource } from "./declared-catalogs";

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
export const assertKnownResource = (where: string, resource: string): void => {
  if (!KNOWN_RESOURCES.includes(resource as CustomFieldResource)) {
    throw new PortersConfigError(
      `${where}: unknown resource "${resource}" (expected one of ${KNOWN_RESOURCES.join(", ")})`,
      { category: "config" },
    );
  }
};

export const assertCustomAlias = (
  where: string,
  alias: string,
  resource: string,
): void => {
  if (!CUSTOM_ALIAS_PATTERN.test(alias)) {
    throw new PortersConfigError(
      `${where}: custom field alias "${alias}" on "${resource}" must start with "U_" or "A_" (standard P_ fields are built in)`,
      { category: "config" },
    );
  }
};

// 知らない Data Type の宣言は、読むと項目が結果から消え、書くと "undefined" が送られていた（RV-79）。
export const assertCustomDataType = (
  where: string,
  dataType: unknown,
  alias: string,
  resource: string,
): void => {
  if (!(CUSTOM_DATA_TYPES as readonly unknown[]).includes(dataType)) {
    throw new PortersConfigError(
      `${where}: "${alias}" on "${resource}" has Data Type ${JSON.stringify(dataType) ?? String(dataType)}, which a custom field cannot have`,
      {
        category: "config",
        hint: `Declare it with the builder in defineFields (f.number(), f.option(), …). A custom field's Data Type is one of ${CUSTOM_DATA_TYPES.join(", ")}.`,
      },
    );
  }
};

/** Check a whole declaration handed to `tenant()`: resources, aliases and Data Types. */
export const assertDeclaredCatalogs = (
  where: string,
  fields: unknown,
): void => {
  if (typeof fields !== "object" || fields === null) {
    throw new PortersConfigError(
      `${where}: fields must be the result of defineFields, got ${JSON.stringify(fields) ?? String(fields)}`,
      { category: "config", hint: "Pass fields: defineFields({ … })." },
    );
  }
  for (const [resource, catalog] of Object.entries(
    fields as Record<string, unknown>,
  )) {
    assertKnownResource(where, resource);
    if (typeof catalog !== "object" || catalog === null) {
      throw new PortersConfigError(
        `${where}: the declaration for "${resource}" must map aliases to Data Types`,
        { category: "config", hint: "Pass fields: defineFields({ … })." },
      );
    }
    for (const [alias, dataType] of Object.entries(catalog)) {
      assertCustomAlias(where, alias, resource);
      assertCustomDataType(where, dataType, alias, resource);
    }
  }
};
