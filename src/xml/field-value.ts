// The values a Read decodes into (ADR-0011 / ADR-0016): what each Data Type reads back as, and
// the record of an expanded reference. Types only — the decoding is `decode-field.ts`.

import type { DataType } from "../porters/data-type";

// System[Department] を User と同じ入れ子として扱う判断は ADR-0061 案3a。
/**
 * A referenced Department (`System[Department]`). Read is nested exactly like
 * `User`: `<OwnerDepartment><Department><Department.P_Id>…`. Only the two fields PORTERS shows in
 * its sample are modelled — inventing more would be guessing.
 */
export type DepartmentRef = {
  P_Id: number | null;
  P_Name: string | null;
};

/** A referenced User (Read is nested; Write is `User.P_Id` only). */
export type UserRef = {
  P_Id: number | null;
  P_Type: string | null;
  P_Name: string | null;
  P_Mail: string | null;
};

/** The sub-tags an Image field is made of (`<Alias><FileName/><ContentType/><Content/></Alias>`). */
export type ImageSubField = "FileName" | "ContentType" | "Content";

// 返ってきた sub-tag だけを optional で持つ形は ADR-0064 論点1。
/**
 * A decoded Image value: the sub-tags PORTERS actually returned, each empty ->
 * null. Every key is **optional for the same reason a read record's fields are** — a sub-tag that
 * was not requested is simply absent. A plain read asks for the bare alias, which PORTERS answers
 * with `FileName` alone; `image` selects more and narrows this to exactly what it selected.
 */
export type ImageValue = { [K in ImageSubField]?: string | null };

// union にして形で読む判断は ADR-0064 論点4。
/**
 * A decoded Link value. PORTERS resolves a Link to **a Contact id, a User, or a
 * Department**, decided by the tenant's own field setting, and the response carries no
 * discriminator — the shapes just differ. So the value is a union and the decode reads the shape,
 * which cannot disagree with what arrived. Narrow with `typeof v === "number"` / `"P_Mail" in v`.
 */
export type LinkValue = number | UserRef | DepartmentRef;

// expand の設計は ADR-0058。
/**
 * An **expanded** `System[Reference]` value: the referenced record's requested fields, decoded by
 * the referenced resource's own catalog. Only a read that asked for the expansion
 * (`expand`) produces one — without it a reference decodes to the referenced id (`number`).
 */
export type ReferenceRecord = { [alias: string]: FieldValue };

// `string[]` is the Option read value (a set of selected aliases — ADR-0017).
export type FieldValue =
  | string
  | number
  | string[]
  | UserRef
  | DepartmentRef
  | ImageValue
  | ReferenceRecord
  | null;

// Per-Data-Type decoded value (the non-null shape), as a **table rather than a conditional chain**.
// Every Data Type is listed exactly once, so the mapping reads at a glance and adding a type to
// `DataType` fails to compile here until it is given a value type — a chain would have silently
// dropped it into the trailing `string`. Mirrors `decodeField`'s branches and drives the static
// resource Read type (ADR-0019).
type DecodedValueOf = {
  "System[Id]": number;
  Number: number;
  "System[Reference]": number;
  User: UserRef;
  "System[Department]": DepartmentRef;
  Option: string[];
  Image: ImageValue;
  Link: LinkValue;
  // The string Data Types share one decoded shape but keep distinct labels (ADR-0016).
  DateTime: string;
  "System[DateTime]": string;
  Date: string;
  Age: string;
  SinglelineText: string;
  MultilineText: string;
  Mail: string;
  Telephone: string;
  URL: string;
};

// A read value is `DecodedValue<D> | null` (empty -> null). `null` = PORTERS assigns the field no
// Data Type (`P_Deleted` — ADR-0056); with no Data Type there is no basis for a conversion, so the
// raw string stands (e.g. `"0"` / `"1"`).
export type DecodedValue<D extends DataType | null> = D extends DataType
  ? DecodedValueOf[D]
  : string;
