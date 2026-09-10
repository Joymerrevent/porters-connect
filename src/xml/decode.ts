// Data-Type-driven value decoding (ADR-0011). Input is the raw node (string or
// nested object) from the parser; output is the typed value. Empty -> null.

import { PortersResourceError } from "../errors/index";
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

const decodeUser = (outer: Record<string, unknown>): UserRef | null => {
  const user = asRecord(outer.User);
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
const decodeDepartment = (
  outer: Record<string, unknown>,
): DepartmentRef | null => {
  const dept = asRecord(outer.Department);
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
const decodeOption = (outer: Record<string, unknown>): string[] | null => {
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
const decodeReference = (outer: Record<string, unknown>): number | null => {
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
const decodeImage = (outer: Record<string, unknown>): ImageValue | null => {
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
  if ("User" in outer) return decodeUser(outer);
  if ("Department" in outer) return decodeDepartment(outer);
  return null;
};

// --- Declared type vs actual data (RV-36 / ADR-0006・ADR-0011) -------------------------------
//
// ADR-0006 requires that a **declared type disagreeing with the real data** surface as
// `category: "validation"`, field name included, and that no silent mis-conversion happen.
// Before RV-36 the opposite was true: an Option field declared as text (or the reverse) decoded to
// `null`, which a caller cannot tell apart from "the field was empty".
//
// The signal is deliberately narrow: a **categorical** shape mismatch. PORTERS sends a scalar for
// the value-shaped types and a nested record for the composite ones, so a record arriving where a
// scalar belongs (or the reverse) can only mean the Data Type is wrong. Anything subtler — an
// unexpected inner tag, a missing `P_Id` — stays tolerant, because there the value may genuinely be
// absent and guessing would trade a silent null for a false alarm.

// Types whose value is a nested record. `Link` is legitimately either (a Contact id, or a nested
// User / Department — ADR-0064 案4a) so it is exempt; everything else is a scalar.
type RecordShaped =
  "Option" | "User" | "System[Reference]" | "System[Department]" | "Image";

/** The scalar-valued Data Types — the complement, so a new Data Type must join one side. */
type ScalarShaped = Exclude<DataType, RecordShaped | "Link">;

const RECORD_SHAPED: ReadonlySet<DataType> = new Set<RecordShaped>([
  "Option",
  "User",
  "System[Reference]",
  "System[Department]",
  "Image",
]);

const isRecordShaped = (type: DataType): type is RecordShaped =>
  RECORD_SHAPED.has(type);

const mismatch = (
  alias: string,
  type: DataType,
  wants: "a nested record" | "a scalar value",
): PortersResourceError =>
  new PortersResourceError(
    `${alias}: declared ${type}, but the value is not ${wants} — PORTERS sends ${wants} for ${type}`,
    {
      category: "validation",
      hint: `The Data Type declared for "${alias}" does not match the field in this partition. Check it against Field Read (verifyFields / generateFieldDecls) and fix the declaration.`,
      context: { operation: "decode" },
    },
  );

// A value whose shape is right but whose *format* is not — the only case is a date-like type
// whose text does not parse. `portersDate*ToIso` throw `RangeError`, which is outside the
// PortersError family and so escapes the documented error contract (RV-36).
//
// Reaching this means one of two things, and both are the same finding: the field's declared Data
// Type is wrong, or PORTERS sent a format the reference does not describe. Either way it is a
// mismatch to report — not a null to swallow.
const converted = (
  alias: string,
  type: DataType,
  value: string,
  convert: () => string,
): string => {
  try {
    return convert();
  } catch (cause) {
    throw new PortersResourceError(
      `${alias}: declared ${type}, but ${JSON.stringify(value)} is not a PORTERS ${type} value`,
      {
        category: "validation",
        hint: `PORTERS sends ${type} as "yyyy/mm/dd${type === "DateTime" || type === "System[DateTime]" ? " HH:MM:SS" : ""}". Check the Data Type declared for "${alias}" against Field Read (verifyFields).`,
        context: { operation: "decode" },
        cause,
      },
    );
  }
};

/** Decode one field's raw node by its Data Type (`null` = PORTERS assigns none — ADR-0056). */
export const decodeField = (
  type: DataType | null,
  raw: unknown,
  /** The field's bare alias, so a mismatch names it (ADR-0006 requires フィールド名付き). */
  alias: string,
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
  // Link is the one type where both shapes are correct — a Contact id is a scalar, a User /
  // Department is nested, and the shape is the discriminator (ADR-0064 案4a). So no shape check.
  if (type === "Link") return decodeLink(raw);
  if (isRecordShaped(type)) {
    const outer = asRecord(raw);
    if (outer === undefined) throw mismatch(alias, type, "a nested record");
    switch (type) {
      case "User":
        return decodeUser(outer);
      case "System[Department]":
        return decodeDepartment(outer);
      case "Option":
        return decodeOption(outer);
      case "System[Reference]":
        return decodeReference(outer);
      case "Image":
        return decodeImage(outer);
    }
  }
  // Scalar-valued from here. The shape check means the branches below need no second `undefined`
  // test: a value that is neither a scalar nor empty has already been rejected as a mismatch.
  const value = asString(raw);
  if (value === undefined) throw mismatch(alias, type, "a scalar value");
  // `type` is `ScalarShaped` here, so a Data Type added to the union without joining either the
  // record-shaped list or this switch fails to compile (the ADR-0016 property, kept).
  const scalarType: ScalarShaped = type;
  switch (scalarType) {
    case "System[Id]":
    case "Number":
      return Number(value);
    // String Data Types share one decode (a plain string); they stay distinct
    // labels for fidelity / future per-type validation (ADR-0016).
    case "SinglelineText":
    case "MultilineText":
    case "Mail":
    case "Telephone":
    case "URL":
      return value;
    // FT-12 DateTime and the system timestamps (registration/update) share the wire
    // format; System[DateTime] is Write-restricted, but that is a write-time concern.
    case "DateTime":
    case "System[DateTime]":
      return converted(alias, scalarType, value, () =>
        portersDateTimeToIso(value),
      );
    // Age shares Date's wire format (`yyyy/mm/dd`); PORTERS transmits the birthdate
    // and derives the age in its UI, so the faithful value is the date itself.
    case "Date":
    case "Age":
      return converted(alias, scalarType, value, () => portersDateToIso(value));
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
      out[alias] = decodeField(types.get(alias) ?? null, child, alias);
    }
    return out;
  }
  return null;
};
