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

// XML 1.0 で書けない文字: 制御文字（タブ・改行・復帰を除く）、U+FFFE / U+FFFF、対になっていない
// サロゲート。エスケープしても表せないので、送る前に拒否する（RV-106）。
const NOT_XML_CHAR =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const xmlText = (alias: string, s: string): string => {
  const bad = NOT_XML_CHAR.exec(s);
  if (bad === null) return escapeXml(s);
  const code = bad[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, "0");
  throw new PortersConfigError(
    `${alias}: the value contains U+${code}, which XML cannot carry`,
    {
      category: "validation",
      hint: "Remove control characters (other than tab and line breaks) and broken surrogate pairs from the value before writing it.",
      context: { operation: "encode" },
    },
  );
};

const scalar = (alias: string, v: NonNullable<WriteValue>): string =>
  xmlText(alias, text(v));

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
// 文字列でない子要素（null など。これも cast 経由）は書かない。"null" の文字列として送らない（RV-103）。
const imageInner = (alias: string, value: NonNullable<WriteValue>): string => {
  if (typeof value !== "object" || Array.isArray(value))
    return scalar(alias, value);
  const parts = value as Partial<Record<ImageSubField, unknown>>;
  return IMAGE_SUBFIELDS.flatMap((sub) => {
    const part = parts[sub];
    return typeof part === "string"
      ? [`<${sub}>${xmlText(alias, part)}</${sub}>`]
      : [];
  }).join("");
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

// id を持つ Data Type。書くのは参照先（または自分）のレコードの id なので、整数でなければならない
// （新規作成の P_Id は -1）。
// 型の無い項目（null / undefined）でも引けるよう、集合の要素の型を広げている（has は false を返す）。
const ID_TYPES: ReadonlySet<DataType | null | undefined> = new Set<DataType>([
  "System[Id]",
  "User",
  "System[Reference]",
  "System[Department]",
  "Link",
]);

// 数の値は、PORTERS が読める 10 進の表記になるものだけを書く。NaN / Infinity は "NaN" / "Infinity"、
// 大きな数や小さな数は "1e+21" / "1e-7" になり、そのまま送られていた（RV-85）。id の項目は整数に限る。
const assertWritableNumber = (
  alias: string,
  type: DataType | null | undefined,
  n: number,
): void => {
  const isId = ID_TYPES.has(type);
  const ok = isId ? Number.isSafeInteger(n) : /^-?\d+(\.\d+)?$/.test(String(n));
  if (ok) return;
  throw new PortersConfigError(
    `${alias}: cannot write ${String(n)}${type ? ` as ${type}` : ""}`,
    {
      category: "validation",
      hint: isId
        ? `${type} values are written as a record id, a whole number.`
        : "Numbers are written as plain decimals: NaN, Infinity and exponent notation (1e21, 1e-7) cannot be written.",
      context: { operation: "encode" },
    },
  );
};

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
  if (typeof value === "number") assertWritableNumber(alias, type, value);
  if (type === undefined || type === null) return scalar(alias, value);
  switch (type) {
    // Option: the selected aliases as empty child elements. Canonical input is an
    // array (ADR-0017, symmetric with read); a lone string is wrapped as a 1-element
    // selection (fail-safe).
    case "Option":
      return (Array.isArray(value) ? value : [text(value)])
        .map((selected: unknown) => {
          // 文字列でない選択肢（[null] など。cast 経由）は <null/> のような要素にしない（RV-104）。
          if (typeof selected !== "string") {
            throw new PortersConfigError(
              `${alias}: option alias ${String(selected)} is not a string`,
              {
                category: "validation",
                hint: 'Pass the selected option aliases as strings, e.g. ["Option.P_Tokyo"].',
                context: { operation: "encode" },
              },
            );
          }
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
        alias,
        converted(alias, type, value, () => isoToPortersDateTime(text(value))),
      );
    // Age shares Date's wire format (`yyyy/mm/dd`): we write the birthdate.
    case "Date":
    case "Age":
      return scalar(
        alias,
        converted(alias, type, value, () => isoToPortersDate(text(value))),
      );
    // Image: the three nested sub-elements (ADR-0064 論点3).
    case "Image":
      return imageInner(alias, value);
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
      return scalar(alias, value);
  }
};
