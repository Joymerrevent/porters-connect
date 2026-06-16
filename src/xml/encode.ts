// Field-Type-driven value encoding for Write (ADR-0011). Read and Write
// representations are asymmetric: User/Reference write the ID only, Option writes
// `<Field><OptionAlias/></Field>`, and DateTime/Date go ISO -> PORTERS. This is the
// mirror of decode.ts; it builds the request body so XML stays out of resources/.

import { isoToPortersDate, isoToPortersDateTime } from "../util/datetime";
import type { FieldType } from "./decode";

/**
 * A value to write. Scalars cover Text / Number / Id and the ID-only User /
 * Reference; a string (or array) is an Option alias. `null` / `undefined` omits
 * the field (leaves it unchanged) — send `""` to clear a Text field.
 */
export type WriteValue = string | number | string[] | null | undefined;

/** One record to write: field alias (bare, e.g. `P_Name`) -> value. */
export type WriteItem = Record<string, WriteValue>;

// Element-content escaping. Only `& < >` are significant in PCDATA; we never emit
// attributes, so quotes are left as-is.
const escapeXml = (s: string): string =>
  s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );

const scalar = (v: string | number | string[]): string => escapeXml(String(v));

/** Encode one field's value into the inner XML of its element. */
export const encodeField = (
  type: FieldType,
  value: string | number | string[],
): string => {
  switch (type) {
    // Option: a single alias or several (multi-select) as empty child elements.
    case "Option":
      return (Array.isArray(value) ? value : [value])
        .map((alias) => `<${alias}/>`)
        .join("");
    case "DateTime":
      return scalar(isoToPortersDateTime(String(value)));
    // Age shares Date's wire format (`yyyy/mm/dd`): we write the birthdate.
    case "Date":
    case "Age":
      return scalar(isoToPortersDate(String(value)));
    // Id / Number / User & Reference (ID-only) / string Data Types all serialize
    // as a scalar (the string types stay distinct labels per ADR-0016).
    case "Id":
    case "Number":
    case "User":
    case "Reference":
    case "SinglelineText":
    case "MultilineText":
    case "Mail":
    case "Telephone":
    case "URL":
      return scalar(value);
  }
};

// One `<Item>…</Item>` body. Unknown aliases (custom U_/A_, no catalog entry) fall
// back to Text — symmetric with decode's raw-string passthrough (fail-safe).
const encodeItem = (
  prefix: string,
  fields: ReadonlyMap<string, FieldType>,
  item: WriteItem,
): string => {
  const parts: string[] = [];
  for (const [alias, value] of Object.entries(item)) {
    // null / undefined -> omit (leave unchanged); "" is kept (clears a Text field).
    if (value === null || value === undefined) continue;
    const type = fields.get(alias);
    const inner = type === undefined ? scalar(value) : encodeField(type, value);
    parts.push(`<${prefix}.${alias}>${inner}</${prefix}.${alias}>`);
  }
  return parts.join("");
};

/** Build a Write request body: `<{Resource}><Item>…</Item>…</{Resource}>`. */
export const buildWriteXml = (config: {
  resource: string;
  prefix: string;
  fields: ReadonlyMap<string, FieldType>;
  items: WriteItem[];
}): string => {
  const items = config.items
    .map(
      (item) =>
        `<Item>${encodeItem(config.prefix, config.fields, item)}</Item>`,
    )
    .join("");
  return `<${config.resource}>${items}</${config.resource}>`;
};
