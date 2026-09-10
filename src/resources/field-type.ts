// PORTERS' Field Type & Data Type List as **one** table (ADR-0069 論点3 / 案3a).
// `Field.P_Type` carries a Field Type *Value*; every other part of the library speaks `DataType`.
// Both directions are needed — Field Read gives a Value (the tooling maps it to a Data Type), and
// the fake server builds Field Read rows from a catalog of Data Types (it maps back) — so the table
// lives here once and both directions are derived from it.
//
// Two hand-written maps is exactly how RV-37 happened (the resource Value table existed twice and
// one copy silently lost Process), so this file is the single source and `field-type.test.ts` fixes
// it against docs/reference/resource-api/field-data-types.md.
//
// The mapping is **not** a bijection:
//   - Option has three Field Types (5 Checkbox / 6 Radiobutton / 7 Dropdown) that decode alike.
//   - 14 Currency is a Number.
//   - The System family shares Value 11, and only `System[Id]` has a published Value at all.
//   - 16 Reference has **no** Data Type (the field carries no value of its own).
// So each direction has to *choose* where a key repeats: `reverse` / `forward` mark the winner.

import type { DataType } from "../xml/decode";

/** One published (Field Type Value, Data Type) pair. */
export type FieldTypeRow = {
  /** `Field.P_Type` on the wire. */
  readonly value: number;
  /** What the value decodes / encodes as. `null` = PORTERS assigns no Data Type (16 Reference). */
  readonly dataType: DataType | null;
  /** PORTERS' own Field Type label, for messages and generated comments. */
  readonly label: string;
  /**
   * Marks the row the **reverse** lookup (Data Type -> Value) picks, since several values can share
   * one Data Type. At most one row per Data Type carries it — `field-type.test.ts` fixes that.
   */
  readonly reverse?: true;
  /**
   * Marks the row the **forward** lookup (Value -> Data Type) picks where a Value repeats. Only
   * Value 11 needs it: the System family shares it and `System[Id]` is the pair PORTERS publishes.
   */
  readonly forward?: true;
};

/**
 * The list, in the reference's own order. Exported so tests and in-repo dev tooling can walk it;
 * callers should use the lookups below rather than scanning it themselves.
 *
 * VERIFY(live): PORTERS publishes no Value for the System family other than `System[Id]`, so the
 * three others are listed under 11 as well — the same assumption the fake server already makes.
 * The Option subtypes may also come back as 5 / 6 rather than always 7. Neither affects a
 * *declarable* type, so the tooling reads the same either way — docs/live-verification.md (LV-12).
 */
export const FIELD_TYPES: readonly FieldTypeRow[] = [
  {
    value: 1,
    dataType: "SinglelineText",
    label: "SinglelineText",
    reverse: true,
  },
  {
    value: 2,
    dataType: "MultilineText",
    label: "MultilineText",
    reverse: true,
  },
  { value: 3, dataType: "Number", label: "Number", reverse: true },
  { value: 4, dataType: "Date", label: "Date", reverse: true },
  { value: 5, dataType: "Option", label: "Option[Checkbox]" },
  { value: 6, dataType: "Option", label: "Option[Radiobutton]" },
  // Every Option field reverses to Dropdown; all three subtypes decode alike (ADR-0017).
  { value: 7, dataType: "Option", label: "Option[Dropdown]", reverse: true },
  { value: 8, dataType: "Age", label: "Age", reverse: true },
  { value: 9, dataType: "URL", label: "URL", reverse: true },
  { value: 10, dataType: "Mail", label: "Mail", reverse: true },
  {
    value: 11,
    dataType: "System[Id]",
    label: "System",
    reverse: true,
    forward: true,
  },
  { value: 11, dataType: "System[DateTime]", label: "System", reverse: true },
  { value: 11, dataType: "System[Reference]", label: "System", reverse: true },
  { value: 11, dataType: "System[Department]", label: "System", reverse: true },
  { value: 12, dataType: "DateTime", label: "DateTime", reverse: true },
  // Currency's Data Type is Number, so it carries no reverse row: Number reverses to 3.
  { value: 14, dataType: "Number", label: "Currency" },
  { value: 15, dataType: "Telephone", label: "Telephone", reverse: true },
  // Reference is display-only — the field holds no value, so there is no Data Type to map.
  { value: 16, dataType: null, label: "Reference" },
  { value: 17, dataType: "User", label: "User", reverse: true },
  { value: 18, dataType: "Image", label: "Image", reverse: true },
  { value: 20, dataType: "Link", label: "Link", reverse: true },
];

// Forward index. Where a Value repeats, the `forward` row wins; otherwise the first row for it.
const BY_VALUE: ReadonlyMap<number, FieldTypeRow> = FIELD_TYPES.reduce(
  (acc, row) => {
    const seen = acc.get(row.value);
    if (seen === undefined || row.forward === true) acc.set(row.value, row);
    return acc;
  },
  new Map<number, FieldTypeRow>(),
);

// Reverse index. Only `reverse` rows take part, so a shared Data Type resolves to one Value.
const BY_DATA_TYPE: ReadonlyMap<DataType, number> = FIELD_TYPES.reduce(
  (acc, row) =>
    row.reverse === true && row.dataType !== null
      ? acc.set(row.dataType, row.value)
      : acc,
  new Map<DataType, number>(),
);

/**
 * What a `Field.P_Type` value means. Three outcomes, kept apart on purpose (ADR-0069 論点4):
 * a Data Type; `null` for a published type that carries no value (16 Reference); and `undefined`
 * for a Value **not in the list at all** — a type PORTERS added since. `undefined` must never be
 * read as "nothing there": the caller reports it rather than dropping it.
 */
export const dataTypeOfFieldType = (
  value: number,
): DataType | null | undefined => BY_VALUE.get(value)?.dataType;

/** PORTERS' own Field Type label for a Value (`undefined` if the Value is not in the list). */
export const fieldTypeLabel = (value: number): string | undefined =>
  BY_VALUE.get(value)?.label;

/**
 * The Field Type Value to report for a Data Type — the reverse direction, used to build Field Read
 * responses (the fake server). Where several values share the Data Type this is the representative
 * (Option -> 7, the System family -> 11, Number -> 3 rather than Currency's 14).
 */
export const fieldTypeValueOf = (dataType: DataType): number | undefined =>
  BY_DATA_TYPE.get(dataType);
