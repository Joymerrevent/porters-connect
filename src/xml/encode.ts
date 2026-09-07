// Data-Type-driven value encoding for Write (ADR-0011). Read and Write
// representations are asymmetric: User/System[Reference] write the ID only, Option writes
// `<Field><OptionAlias/></Field>`, and DateTime/Date go ISO -> PORTERS. This is the
// mirror of decode.ts; it builds the request body so XML stays out of resources/.

import { qualify } from "../util/alias";
import { isoToPortersDate, isoToPortersDateTime } from "../util/datetime";
import type { DataType, ImageSubField } from "./decode";

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
export type WriteValue =
  string | number | string[] | ImageWriteValue | null | undefined;

/**
 * The MIME types PORTERS accepts for an Image field's `ContentType` (reference: Write API - XML
 * Format). Exported so the send-time guard and the static Write input agree on one list
 * (ADR-0064 論点3).
 */
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/gif",
  "image/png",
  "image/bmp",
] as const;

/** One of the four MIME types an Image field accepts. */
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

/**
 * An Image field's write value (ADR-0064 論点3): the three sub-elements PORTERS' Write format
 * names, with `Content` Base64-encoded. All three are **required** — PORTERS' sample writes the
 * full element and the library has no basis for a partial write; a value is either supplied whole
 * or the field is omitted (`null` / `undefined`, like every other field).
 *
 * The keys are spelled exactly as they read back, so a read value feeds straight back into a write
 * — **once its sub-tags are known to be present**. A read part is `string | null` (null = requested
 * but empty) and there is nothing to write for a null, so that check is the caller's.
 *
 * Size / name-length / MIME are checked **before the request goes out** (the ~15000-char request
 * guard is lifted for an image write, so this is what replaces it).
 */
export type ImageWriteValue = {
  FileName: string;
  ContentType: ImageContentType;
  Content: string;
};

/** One record to write: field alias (bare, e.g. `P_Name`) -> value. */
export type WriteItem = Record<string, WriteValue>;

// Data Types a user may write. `System[Id]` is library-supplied (`P_Id=-1`/target id) and
// `System[DateTime]` (registration/update) is Write-restricted by PORTERS — both are excluded
// from the static Write input so they cannot be set (ADR-0016 promise, realized in ADR-0019).
// `System[Department]` も除外する: PORTERS は Phase / User でこの型を**読み**に出すだけで、
// 書けるのか・書けるとしてどの形（`Department.P_Id`？）かを公表していない。推測した形を送るより
// **書けないことにしておく**ほうが安全側（ADR-0061 案3a の注意）。VERIFY(live): 契約後に確認する。
export type WritableDataType = Exclude<
  DataType,
  "System[Id]" | "System[DateTime]" | "System[Department]"
>;

// Per-Data-Type write value (mirror of `encodeField`): User / System[Reference] / Number take a
// number, Option an alias array, the rest a scalar string. Drives the static Write type (ADR-0019).
// A field PORTERS gives no Data Type (`null` — ADR-0056) has no write value at all: it is already
// out of `WritableKeys`, and `never` keeps it that way if it is ever reached directly.
export type WriteValueOf<D extends DataType | null> = D extends null
  ? never
  : D extends "User" | "System[Reference]" | "Number" | "Link"
    ? number
    : D extends "Option"
      ? string[]
      : D extends "Image"
        ? ImageWriteValue
        : string;

// Element-content escaping. Only `& < >` are significant in PCDATA; we never emit
// attributes, so quotes are left as-is.
const escapeXml = (s: string): string =>
  s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );

// Image is the only Data Type whose value is an object. One handed to any *other* type can only
// arrive through a cast, and `String({…})` would put a useless "[object Object]" on the wire — so
// serialize it visibly instead and let PORTERS reject it, with the value still readable in the error.
const text = (v: NonNullable<WriteValue>): string =>
  typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : String(v);

const scalar = (v: NonNullable<WriteValue>): string => escapeXml(text(v));

// Write order follows PORTERS' own sample: `<FileName/><ContentType/><Content/>`.
const IMAGE_SUBFIELDS: readonly ImageSubField[] = [
  "FileName",
  "ContentType",
  "Content",
];

// An Image writes as the three nested sub-elements (write-format.md). The static Write input
// requires all three, so a missing key can only arrive through a cast: emit what is there rather
// than an empty element PORTERS would read as "clear this" (fail-safe — we never invent a value).
// A non-object value (also cast-only) has no nested form at all, so it falls back to a scalar,
// the same passthrough an uncatalogued alias gets.
const imageInner = (value: NonNullable<WriteValue>): string => {
  if (typeof value !== "object" || Array.isArray(value)) return scalar(value);
  const parts = value as Partial<Record<ImageSubField, string>>;
  return IMAGE_SUBFIELDS.filter((sub) => parts[sub] !== undefined)
    .map((sub) => `<${sub}>${escapeXml(String(parts[sub]))}</${sub}>`)
    .join("");
};

/** Encode one field's value into the inner XML of its element. */
export const encodeField = (
  type: DataType,
  value: NonNullable<WriteValue>,
): string => {
  switch (type) {
    // Option: the selected aliases as empty child elements. Canonical input is an
    // array (ADR-0017, symmetric with read); a lone string is wrapped as a 1-element
    // selection (fail-safe).
    case "Option":
      return (Array.isArray(value) ? value : [text(value)])
        .map((alias) => `<${alias}/>`)
        .join("");
    // System[DateTime] (registration/update) is Write-restricted by PORTERS; we still
    // serialize it identically — rejecting the write is the input type's job (SD-3).
    case "DateTime":
    case "System[DateTime]":
      return scalar(isoToPortersDateTime(text(value)));
    // Age shares Date's wire format (`yyyy/mm/dd`): we write the birthdate.
    case "Date":
    case "Age":
      return scalar(isoToPortersDate(text(value)));
    // Image: the three nested sub-elements (ADR-0064 論点3).
    case "Image":
      return imageInner(value);
    // System[Id] / Number / User & System[Reference] / Link (all ID-only) / string Data Types all
    // serialize as a scalar (the string types stay distinct labels per ADR-0016).
    // Link の Read は 3 形の union だが、Write は ID ひとつ（`<Alias>10001</Alias>`）＝ User と同じ。
    // System[Department] は静的な Write 入力から外してあるので、ここに来るのは cast 経由のみ
    // （System[DateTime] と同じ扱い）。到達したときは User と同じくスカラとして書き出す。
    case "Link":
    case "System[Id]":
    case "Number":
    case "User":
    case "System[Reference]":
    case "System[Department]":
    case "SinglelineText":
    case "MultilineText":
    case "Mail":
    case "Telephone":
    case "URL":
      return scalar(value);
  }
};

// One `<Item>…</Item>` body. Aliases without a Data Type fall back to Text — symmetric with
// decode's raw-string passthrough (fail-safe). Two ways to get there: a custom U_/A_ alias with no
// catalog entry (`undefined`), or a catalogued field PORTERS gives no Data Type (`null` — ADR-0056).
// The latter only arrives via a cast: the static Write input excludes it, as PORTERS does.
const encodeItem = (
  prefix: string,
  fields: ReadonlyMap<string, DataType | null>,
  item: WriteItem,
): string => {
  const parts: string[] = [];
  for (const [alias, value] of Object.entries(item)) {
    // null / undefined -> omit (leave unchanged); "" is kept (clears a Text field).
    if (value === null || value === undefined) continue;
    const type = fields.get(alias);
    const inner =
      type === undefined || type === null
        ? scalar(value)
        : encodeField(type, value);
    const tag = qualify(prefix, alias);
    parts.push(`<${tag}>${inner}</${tag}>`);
  }
  return parts.join("");
};

/**
 * One record as its full `<Item>…</Item>` element. Exposed so the bulk-write chunker can
 * measure each record's serialized length when packing a request under the size cap (ADR-0041).
 */
export const encodeWriteItem = (
  prefix: string,
  fields: ReadonlyMap<string, DataType | null>,
  item: WriteItem,
): string => `<Item>${encodeItem(prefix, fields, item)}</Item>`;

/** Build a Write request body: `<{Resource}><Item>…</Item>…</{Resource}>`. */
export const buildWriteXml = (config: {
  resource: string;
  prefix: string;
  fields: ReadonlyMap<string, DataType | null>;
  items: WriteItem[];
}): string => {
  const items = config.items
    .map((item) => encodeWriteItem(config.prefix, config.fields, item))
    .join("");
  return `<${config.resource}>${items}</${config.resource}>`;
};
