// Field-Type-driven value decoding (ADR-0011). Input is the raw node (string or
// nested object) from the parser; output is the typed value. Empty -> null.

import { portersDateToIso, portersDateTimeToIso } from "../util/datetime";
import { asRecord, asString } from "./raw";

// Granularity = PORTERS Data Type (ADR-0016). Labels are the literal Data Type
// strings, incl. the System family (`System[Id]` / `System[DateTime]` / `System[Reference]`).
// Currency collapses to Number and the three Option subtypes to Option (PORTERS' own
// Data Type does the same); the string Data Types stay distinct (room for future
// validation / normalisation). The `System[…]` qualifier marks system-managed values
// (auto-assigned, often Write-restricted); that lifecycle is enforced via input types,
// not here — decoding is by value shape.
export type FieldType =
  | "System[Id]"
  | "Number"
  | "DateTime"
  | "System[DateTime]"
  | "Date"
  | "Age"
  | "SinglelineText"
  | "MultilineText"
  | "Mail"
  | "Telephone"
  | "URL"
  | "User"
  | "Option"
  | "System[Reference]";

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

// Read: the selected leaf aliases (e.g. `<Option.P_Tokyo/>`) sit under `<OptionRoot>`.
// PORTERS represents single/multi alike as a set, so return every selected alias verbatim
// — incl. the `Option.` prefix (ADR-0017). None / empty -> null.
// VERIFY(live): the `Option.` prefix and the `OptionRoot` wrapper come from the Read API
// doc, not a live contract; we tolerate a missing wrapper. See docs/live-verification.md (LV-1, LV-2).
const decodeOption = (raw: unknown): string[] | null => {
  const outer = asRecord(raw);
  if (!outer) return null;
  // Aliases live under `<OptionRoot>` when present; the doc's sample omits it, so fall
  // back to the field's own children.
  const root = "OptionRoot" in outer ? asRecord(outer.OptionRoot) : outer;
  if (!root) return null;
  const keys = Object.keys(root);
  return keys.length > 0 ? keys : null;
};

// System[Reference] Read mirrors User: <Field><Resource>...</Resource></Field>, but the
// inner tag varies (Client/Recruiter/...). Write is ID-only, so we decode the referenced
// record's id — enough to round-trip. Richer reference reading is future work (SD-3).
// NB: the label is literally `System[Reference]` (a nested record). It is NOT the
// display-only Field-Type-16 "Reference" (a scalar mirror, Data Type `—`), left uncatalogued.
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
    case "System[Id]":
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
    // FT-12 DateTime and the system timestamps (registration/update) share the wire
    // format; System[DateTime] is Write-restricted, but that is a write-time concern.
    case "DateTime":
    case "System[DateTime]": {
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
    case "System[Reference]":
      return decodeReference(raw);
  }
};
