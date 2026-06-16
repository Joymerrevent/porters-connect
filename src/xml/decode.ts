// Field-Type-driven value decoding (ADR-0011). Input is the raw node (string or
// nested object) from the parser; output is the typed value. Empty -> null.

import { portersDateToIso, portersDateTimeToIso } from "../util/datetime";
import { asRecord, asString } from "./raw";

// Granularity = PORTERS Data Type (ADR-0016). Currency collapses to Number and the
// three Option subtypes to Option (PORTERS' own Data Type does the same); the string
// Data Types stay distinct (room for future validation / normalisation).
export type FieldType =
  | "Id"
  | "Number"
  | "DateTime"
  | "Date"
  | "Age"
  | "SinglelineText"
  | "MultilineText"
  | "Mail"
  | "Telephone"
  | "URL"
  | "User"
  | "Option"
  | "Reference";

/** A referenced User (Read is nested; Write is `User.P_Id` only). */
export type UserRef = {
  P_Id: number | null;
  P_Type: string | null;
  P_Name: string | null;
  P_Mail: string | null;
};

// `string[]` is the Option read value (a set of selected aliases — ADR-0017).
export type FieldValue = string | number | string[] | UserRef | null;

// alias タグは接頭辞付き想定（例 `User.P_Id`）だが、接頭辞無しにも両対応（ADR-0011）。
// 全 arrow（ADR-0013）＝巻き上げ無しのため、ヘルパーを decodeField より前に定義する。
const pickPrefixed = (
  obj: Record<string, unknown>,
  prefix: string,
  key: string,
): string | undefined =>
  asString(obj[`${prefix}.${key}`]) ?? asString(obj[key]);

const decodeUser = (raw: unknown): UserRef | null => {
  const outer = asRecord(raw);
  const user = outer ? asRecord(outer.User) : undefined;
  if (!user) return null;
  const id = pickPrefixed(user, "User", "P_Id");
  return {
    P_Id: id === undefined ? null : Number(id),
    P_Type: pickPrefixed(user, "User", "P_Type") ?? null,
    P_Name: pickPrefixed(user, "User", "P_Name") ?? null,
    P_Mail: pickPrefixed(user, "User", "P_Mail") ?? null,
  };
};

// Read: <OptionRoot><{末端Alias}>...</{末端Alias}>...</OptionRoot>。PORTERS は単一/複数とも
// alias の集合で表すので、選択された全末端 alias を配列で返す（未選択は null。ADR-0017）。
const decodeOption = (raw: unknown): string[] | null => {
  const outer = asRecord(raw);
  const root = outer ? asRecord(outer.OptionRoot) : undefined;
  if (!root) return null;
  const keys = Object.keys(root);
  return keys.length > 0 ? keys : null;
};

// System[Reference] Read mirrors User: <Field><Resource>...</Resource></Field>, but the
// inner tag varies (Client/Recruiter/...). Write is ID-only, so we decode the referenced
// record's id — enough to round-trip. Richer reference reading is future work (SD-3).
// NB: this "Reference" is System[Reference] (a nested record). It is NOT the display-only
// Field-Type-16 "Reference" (a scalar mirror of a related value), which is left uncatalogued.
const decodeReference = (raw: unknown): number | null => {
  const outer = asRecord(raw);
  if (!outer) return null;
  // The nested resource is the first record-valued child (skip attributes / siblings,
  // which decodeUser avoids via a fixed key — here the tag varies). Read that record's
  // own `{Tag}.P_Id` (prefix-less also accepted), not just any key ending in P_Id.
  for (const [tag, value] of Object.entries(outer)) {
    const inner = asRecord(value);
    if (!inner) continue;
    const id = asString(inner[`${tag}.P_Id`]) ?? asString(inner.P_Id);
    return id === undefined ? null : Number(id);
  }
  return null;
};

/** Decode one field's raw node by its Field Type. */
export const decodeField = (type: FieldType, raw: unknown): FieldValue => {
  // `raw === ""` is load-bearing (a Text "" must become null, not stay "");
  // `=== undefined` / `=== null` are defense-in-depth — every switch branch below
  // also maps them to null, so dropping either is an equivalent mutant.
  // Stryker disable next-line ConditionalExpression: see above (undefined/null are redundant with the switch)
  if (raw === "" || raw === undefined || raw === null) return null;
  switch (type) {
    case "Id":
    case "Number": {
      // raw is neither "" nor non-string here (guarded above), so `s` is a
      // non-empty string or undefined — `s === ""` would be dead.
      const s = asString(raw);
      return s === undefined ? null : Number(s);
    }
    // String Data Types share one decode (a plain string); they stay distinct
    // labels for fidelity / future per-type validation (ADR-0016).
    case "SinglelineText":
    case "MultilineText":
    case "Mail":
    case "Telephone":
    case "URL":
      return asString(raw) ?? null;
    case "DateTime": {
      const s = asString(raw);
      return s === undefined ? null : portersDateTimeToIso(s);
    }
    // Age shares Date's wire format (`yyyy/mm/dd`); PORTERS transmits the birthdate
    // and derives the age in its UI, so the faithful value is the date itself.
    case "Date":
    case "Age": {
      const s = asString(raw);
      return s === undefined ? null : portersDateToIso(s);
    }
    case "User":
      return decodeUser(raw);
    case "Option":
      return decodeOption(raw);
    case "Reference":
      return decodeReference(raw);
  }
};
