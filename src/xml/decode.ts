// Field-Type-driven value decoding (ADR-0011). Input is the raw node (string or
// nested object) from the parser; output is the typed value. Empty -> null.

import { portersDateToIso, portersDateTimeToIso } from "../util/datetime";
import { asRecord, asString } from "./raw";

export type FieldType =
  | "Id"
  | "Number"
  | "DateTime"
  | "Date"
  | "Text"
  | "User"
  | "Option";

/** A referenced User (Read is nested; Write is `User.P_Id` only). */
export interface UserRef {
  P_Id: number | null;
  P_Type: string | null;
  P_Name: string | null;
  P_Mail: string | null;
}

export type FieldValue = string | number | UserRef | null;

/** Decode one field's raw node by its Field Type. */
export function decodeField(type: FieldType, raw: unknown): FieldValue {
  if (raw === "" || raw === undefined || raw === null) return null;
  switch (type) {
    case "Id":
    case "Number": {
      const s = asString(raw);
      return s === undefined || s === "" ? null : Number(s);
    }
    case "Text":
      return asString(raw) ?? null;
    case "DateTime": {
      const s = asString(raw);
      return s === undefined ? null : portersDateTimeToIso(s);
    }
    case "Date": {
      const s = asString(raw);
      return s === undefined ? null : portersDateToIso(s);
    }
    case "User":
      return decodeUser(raw);
    case "Option":
      return decodeOption(raw);
  }
}

// alias タグは接頭辞付き想定（例 `User.P_Id`）だが、接頭辞無しにも両対応（ADR-0011）。
function pickPrefixed(
  obj: Record<string, unknown>,
  prefix: string,
  key: string,
): string | undefined {
  return asString(obj[`${prefix}.${key}`]) ?? asString(obj[key]);
}

function decodeUser(raw: unknown): UserRef | null {
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
}

// Read: <OptionRoot><{末端Alias}>...</{末端Alias}></OptionRoot>。単一選択は末端 alias を返す。
function decodeOption(raw: unknown): string | null {
  const outer = asRecord(raw);
  const root = outer ? asRecord(outer.OptionRoot) : undefined;
  if (!root) return null;
  const keys = Object.keys(root);
  return keys.length > 0 ? keys[0] : null;
}
