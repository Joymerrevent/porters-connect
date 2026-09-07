// Data-Type-driven value decoding (ADR-0011). Input is the raw node (string or
// nested object) from the parser; output is the typed value. Empty -> null.

import { portersDateToIso, portersDateTimeToIso } from "../util/datetime";
import { asRecord, asString } from "./raw";

// Granularity = PORTERS Data Type (ADR-0016). Labels are the literal Data Type
// strings, incl. the System family (`System[Id]` / `System[DateTime]` / `System[Reference]`).
// Currency collapses to Number and the three Option subtypes to Option (PORTERS' own
// Data Type does the same); the string Data Types stay distinct (room for future
// validation / normalisation). Image (FT-18) and Link (FT-20) complete the set (ADR-0064);
// neither appears in any standard catalog — they reach the library only as tenant custom
// fields declared with `defineFields`. The `System[…]` qualifier marks system-managed values
// (auto-assigned, often Write-restricted); that lifecycle is enforced via input types,
// not here — decoding is by value shape.
export type DataType =
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
  | "System[Reference]"
  | "System[Department]"
  | "Image"
  | "Link";

/**
 * A referenced Department (`System[Department]` — ADR-0061 案3a). Read is nested exactly like
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

/**
 * A decoded Image value (ADR-0064 論点1): the sub-tags PORTERS actually returned, each empty ->
 * null. Every key is **optional for the same reason a read record's fields are** — a sub-tag that
 * was not requested is simply absent. A plain read asks for the bare alias, which PORTERS answers
 * with `FileName` alone; `image` selects more and narrows this to exactly what it selected.
 */
export type ImageValue = { [K in ImageSubField]?: string | null };

/**
 * A decoded Link value (ADR-0064 論点4). PORTERS resolves a Link to **a Contact id, a User, or a
 * Department**, decided by the tenant's own field setting, and the response carries no
 * discriminator — the shapes just differ. So the value is a union and the decode reads the shape,
 * which cannot disagree with what arrived. Narrow with `typeof v === "number"` / `"P_Mail" in v`.
 */
export type LinkValue = number | UserRef | DepartmentRef;

/**
 * An **expanded** `System[Reference]` value: the referenced record's requested fields, decoded by
 * the referenced resource's own catalog (ADR-0058). Only a read that asked for the expansion
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

// Per-Data-Type decoded value (the non-null shape). A read value is `DecodedValue<D> | null`
// (empty -> null). Mirrors `decodeField`'s branches and drives the static resource Read type
// (ADR-0019): id/number/reference -> number, User -> UserRef, Option -> string[], rest -> string.
// `null` = PORTERS assigns the field no Data Type (`P_Deleted` — ADR-0056). With no Data Type
// there is no basis for a conversion, so the raw string stands (e.g. `"0"` / `"1"`).
export type DecodedValue<D extends DataType | null> = D extends null
  ? string
  : D extends "System[Id]" | "Number" | "System[Reference]"
    ? number
    : D extends "User"
      ? UserRef
      : D extends "System[Department]"
        ? DepartmentRef
        : D extends "Option"
          ? string[]
          : D extends "Image"
            ? ImageValue
            : D extends "Link"
              ? LinkValue
              : string;

// A tag's bare alias: `Client.P_Name` -> `P_Name`. Nested reference tags carry the *referenced*
// resource's prefix, which nothing here knows. Mirrors `bareAlias` in resources/read-core.ts.
// Stryker disable StringLiteral: for a dotless tag both branches yield the tag itself
const bareTag = (key: string): string =>
  key.includes(".") ? key.slice(key.indexOf(".") + 1) : key;
// Stryker restore StringLiteral

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

// System[Department] mirrors User: `<Field><Department><Department.P_Id>…</Department></Field>`
// (ADR-0061 — the shape comes from PORTERS' own 2019-12-10 sample, not a guess).
const decodeDepartment = (raw: unknown): DepartmentRef | null => {
  const outer = asRecord(raw);
  const dept = outer ? asRecord(outer.Department) : undefined;
  if (!dept) return null;
  const id = pickPrefixed(dept, "Department", "P_Id");
  return {
    P_Id: id === undefined ? null : Number(id),
    P_Name: pickPrefixed(dept, "Department", "P_Name") ?? null,
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
  // which decodeUser avoids via a fixed key — here the tag varies). Read that record's own
  // `P_Id` by its **bare** alias: the wrapper tag is the referenced resource's name while its
  // aliases carry that resource's *prefix*, and the two differ (Candidate is `<Candidate>` with
  // `Person.P_Id` — LV-10 / LV-16). Matching on the bare alias needs neither to be known here,
  // and still reads only that record's id rather than any key that happens to end in P_Id.
  for (const value of Object.values(outer)) {
    const inner = asRecord(value);
    if (!inner) continue;
    for (const [key, child] of Object.entries(inner)) {
      if (bareTag(key) !== "P_Id") continue;
      const id = asString(child);
      return id === undefined ? null : Number(id);
    }
    return null;
  }
  return null;
};

// Image Read: `<Alias><FileName>photo.png</FileName></Alias>`. Only the sub-tags the request
// asked for are present (the bare alias returns `FileName` alone — ADR-0064 案1a), so we keep the
// keys that arrived rather than filling in the other two: absent means "not requested", while
// `null` means "requested and empty" — the same distinction the read record itself draws.
// The sub-tags are bare in PORTERS' sample; `bareTag` also tolerates a prefixed form.
const decodeImage = (raw: unknown): ImageValue | null => {
  const outer = asRecord(raw);
  if (!outer) return null;
  const out: ImageValue = {};
  for (const [key, child] of Object.entries(outer)) {
    const sub = bareTag(key);
    if (sub !== "FileName" && sub !== "ContentType" && sub !== "Content")
      continue;
    const value = asString(child);
    // An empty element parses to "" -> null, like every other empty value.
    out[sub] = value === undefined || value === "" ? null : value;
  }
  return out;
};

// Link Read (ADR-0064 案4a): the value is a Contact id, a User, or a Department, and PORTERS
// sends **no discriminator** — the shapes differ and nothing else does. Read the shape:
// a scalar is the Contact id, `<User>` is a user, `<Department>` a department. Anything else
// decodes to null rather than to a guess.
// VERIFY(live): the User / Department forms are assumed to nest exactly like the `User` and
// `System[Department]` Data Types do, which is what the reference implies but does not show for
// Link specifically. See docs/live-verification.md (LV-19).
const decodeLink = (raw: unknown): LinkValue | null => {
  const scalar = asString(raw);
  if (scalar !== undefined) return Number(scalar);
  const outer = asRecord(raw);
  if (!outer) return null;
  if ("User" in outer) return decodeUser(raw);
  if ("Department" in outer) return decodeDepartment(raw);
  return null;
};

/** Decode one field's raw node by its Data Type (`null` = PORTERS assigns none — ADR-0056). */
export const decodeField = (
  type: DataType | null,
  raw: unknown,
): FieldValue => {
  // `raw === ""` is load-bearing (a Text "" must become null, not stay "");
  // `=== undefined` / `=== null` are defense-in-depth — every switch branch below
  // also maps them to null, so dropping either is an equivalent mutant.
  // Stryker disable next-line ConditionalExpression: see above (undefined/null are redundant with the switch)
  if (raw === "" || raw === undefined || raw === null) return null;
  // 型が無い項目（catalog の `null`＝ADR-0056）は変換の基準も無いので生の文字列で通す。
  // カタログ外の U_/A_ alias に対する `decoderFor` の passthrough と同じ扱い。
  // VERIFY(live): `P_Deleted` が実際に `<Person.P_Deleted>0</…>` の平文で返るか、
  // itemstate 省略時にも返るか、値が 0/1 以外を取りうるかは未確認。
  // docs/live-verification.md（LV-14）。外れたらこの分岐を直す。
  if (type === null) return asString(raw) ?? null;
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
    case "System[Department]":
      return decodeDepartment(raw);
    case "Option":
      return decodeOption(raw);
    case "System[Reference]":
      return decodeReference(raw);
    case "Image":
      return decodeImage(raw);
    case "Link":
      return decodeLink(raw);
  }
};

/**
 * Decode an **expanded** `System[Reference]` node (`field=Job.P_Client(Client.P_Id,Client.P_Name)`)
 * into the referenced record, using the referenced resource's catalog (ADR-0058).
 *
 * `types` is handed in rather than looked up: `xml/` must not depend on `resources/` (RV-8), and
 * this is also what keeps the decode **tag-independent** — the wrapper element is the referenced
 * resource (`<Client>`), which we neither know nor need here. That matters because the literal tag
 * is unconfirmed against the live API (LV-10); reading the first record-valued child means an
 * unexpected tag costs nothing. An alias outside the catalog decodes as a raw string, exactly as
 * an unknown alias does on the top-level record.
 */
export const decodeReferenceRecord = (
  raw: unknown,
  types: ReadonlyMap<string, DataType | null>,
): ReferenceRecord | null => {
  const outer = asRecord(raw);
  if (!outer) return null;
  for (const value of Object.values(outer)) {
    const inner = asRecord(value);
    if (!inner) continue;
    const out: ReferenceRecord = {};
    for (const [key, child] of Object.entries(inner)) {
      const alias = bareTag(key);
      out[alias] = decodeField(types.get(alias) ?? null, child);
    }
    return out;
  }
  return null;
};
