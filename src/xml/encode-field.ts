// Data-Type-driven value encoding for Write (ADR-0011). Read and Write representations are
// asymmetric: User/System[Reference] write the ID only, Option writes `<Field><OptionAlias/></Field>`,
// and DateTime/Date go ISO -> PORTERS. The mirror of `decode-field.ts`.

import { PortersConfigError } from "../errors/index";
import {
  isoExample,
  isoToPortersDate,
  isoToPortersDateTime,
} from "../util/datetime";
import type { DataType } from "../porters/data-type";
import { assertTagName } from "./assert-tag-name";
import type { ImageSubField } from "./field-value";
import type { WriteValue } from "./write-value";

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

// A caller's value that cannot be converted (RV-36 / ADR-0006). `PortersConfigError` because the
// value came from the caller, not PORTERS — the class means "misuse, not PORTERS-originated" — and
// `category: "validation"` because ADR-0006 defines that as「入力・パラメータ・書式」while it scopes
// `config` to `defineFields` / client options.
//
// Only the date types can fail here: they are the only ones this file **converts** (ISO 8601 ->
// PORTERS `yyyy/mm/dd[ HH:MM:SS]`). Everything else is written through as a scalar, so there is
// nothing to fail. That asymmetry is intended, not an oversight (RV-36 #4 = 案3).
const invalidValue = (
  alias: string,
  type: DataType,
  value: NonNullable<WriteValue>,
  cause: unknown,
): PortersConfigError =>
  new PortersConfigError(
    `${alias}: cannot write ${JSON.stringify(value)} as ${type}`,
    {
      category: "validation",
      hint: `${type} values are written in ${isoExample(type)}; the library converts them to PORTERS' format.`,
      // The underlying RangeError stays on `cause` rather than in the message: the message
      // already names the field, the value and the type, which is what a reader needs.
      context: { operation: "encode" },
      cause,
    },
  );

// Runs a conversion and re-labels its failure as the library's own error type. `isoToPorters*`
// throw `RangeError`, which is outside the PortersError family and so escapes the documented
// error contract (RV-36).
const converted = (
  alias: string,
  type: DataType,
  value: NonNullable<WriteValue>,
  convert: () => string,
): string => {
  try {
    return convert();
  } catch (cause) {
    throw invalidValue(alias, type, value, cause);
  }
};

// Aliases without a Data Type are written as Text — symmetric with decode's raw-string passthrough
// (fail-safe). Two ways to get there: a custom U_/A_ alias with no catalog entry (`undefined`), or a
// catalogued field PORTERS gives no Data Type (`null` — ADR-0056). The latter only arrives via a
// cast: the static Write input excludes it, as PORTERS does.
/** Encode one field's value into the inner XML of its element. */
export const encodeField = (
  type: DataType | null | undefined,
  value: NonNullable<WriteValue>,
  /** The field's bare alias, so an unconvertible value names it (ADR-0006). */
  alias: string,
): string => {
  if (type === undefined || type === null) return scalar(value);
  switch (type) {
    // Option: the selected aliases as empty child elements. Canonical input is an
    // array (ADR-0017, symmetric with read); a lone string is wrapped as a 1-element
    // selection (fail-safe).
    case "Option":
      return (Array.isArray(value) ? value : [text(value)])
        .map((selected) => {
          // 選択肢 alias は**要素名になる**（write-format.md）。ここが ADR-0085 の主目的。
          assertTagName(selected, "option alias", alias);
          return `<${selected}/>`;
        })
        .join("");
    // System[DateTime] (registration/update) is Write-restricted by PORTERS; we still
    // serialize it identically — rejecting the write is the input type's job (SD-3).
    case "DateTime":
    case "System[DateTime]":
      return scalar(
        converted(alias, type, value, () => isoToPortersDateTime(text(value))),
      );
    // Age shares Date's wire format (`yyyy/mm/dd`): we write the birthdate.
    case "Date":
    case "Age":
      return scalar(
        converted(alias, type, value, () => isoToPortersDate(text(value))),
      );
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
