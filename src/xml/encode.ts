// Data-Type-driven value encoding for Write (ADR-0011). Read and Write
// representations are asymmetric: User/System[Reference] write the ID only, Option writes
// `<Field><OptionAlias/></Field>`, and DateTime/Date go ISO -> PORTERS. This is the
// mirror of decode.ts; it builds the request body so XML stays out of resources/.

import { isoToPortersDate, isoToPortersDateTime } from "../util/datetime";
import type { DataType } from "./decode";

/**
 * A value to write. Scalars cover the string Data Types / Number / Id and the
 * ID-only User / Reference. An **Option** value is an array of selected aliases
 * (`string[]`) — symmetric with the Option read shape (ADR-0017); a lone string
 * is tolerated as a 1-element selection (fail-safe). `null` / `undefined` omits the
 * field (leaves it unchanged) — send `""` to clear a string field.
 *
 * Per-field static typing (Option fields as `string[]`, etc.) is future work — the
 * precise static Write type (SD-3).
 */
export type WriteValue = string | number | string[] | null | undefined;

/** One record to write: field alias (bare, e.g. `P_Name`) -> value. */
export type WriteItem = Record<string, WriteValue>;

// Data Types a user may write. `System[Id]` is library-supplied (`P_Id=-1`/target id) and
// `System[DateTime]` (registration/update) is Write-restricted by PORTERS — both are excluded
// from the static Write input so they cannot be set (ADR-0016 promise, realized in ADR-0019).
export type WritableDataType = Exclude<
  DataType,
  "System[Id]" | "System[DateTime]"
>;

// Per-Data-Type write value (mirror of `encodeField`): User / System[Reference] / Number take a
// number, Option an alias array, the rest a scalar string. Drives the static Write type (ADR-0019).
export type WriteValueOf<D extends DataType> = D extends
  | "User"
  | "System[Reference]"
  | "Number"
  ? number
  : D extends "Option"
    ? string[]
    : string;

// Element-content escaping. Only `& < >` are significant in PCDATA; we never emit
// attributes, so quotes are left as-is.
const escapeXml = (s: string): string =>
  s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );

const scalar = (v: string | number | string[]): string => escapeXml(String(v));

/** Encode one field's value into the inner XML of its element. */
export const encodeField = (
  type: DataType,
  value: string | number | string[],
): string => {
  switch (type) {
    // Option: the selected aliases as empty child elements. Canonical input is an
    // array (ADR-0017, symmetric with read); a lone string is wrapped as a 1-element
    // selection (fail-safe).
    case "Option":
      return (Array.isArray(value) ? value : [value])
        .map((alias) => `<${alias}/>`)
        .join("");
    // System[DateTime] (registration/update) is Write-restricted by PORTERS; we still
    // serialize it identically — rejecting the write is the input type's job (SD-3).
    case "DateTime":
    case "System[DateTime]":
      return scalar(isoToPortersDateTime(String(value)));
    // Age shares Date's wire format (`yyyy/mm/dd`): we write the birthdate.
    case "Date":
    case "Age":
      return scalar(isoToPortersDate(String(value)));
    // System[Id] / Number / User & System[Reference] (ID-only) / string Data Types all
    // serialize as a scalar (the string types stay distinct labels per ADR-0016).
    case "System[Id]":
    case "Number":
    case "User":
    case "System[Reference]":
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
  fields: ReadonlyMap<string, DataType>,
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

/**
 * One record as its full `<Item>…</Item>` element. Exposed so the bulk-write chunker can
 * measure each record's serialized length when packing a request under the size cap (ADR-0041).
 */
export const encodeWriteItem = (
  prefix: string,
  fields: ReadonlyMap<string, DataType>,
  item: WriteItem,
): string => `<Item>${encodeItem(prefix, fields, item)}</Item>`;

/** Build a Write request body: `<{Resource}><Item>…</Item>…</{Resource}>`. */
export const buildWriteXml = (config: {
  resource: string;
  prefix: string;
  fields: ReadonlyMap<string, DataType>;
  items: WriteItem[];
}): string => {
  const items = config.items
    .map((item) => encodeWriteItem(config.prefix, config.fields, item))
    .join("");
  return `<${config.resource}>${items}</${config.resource}>`;
};
