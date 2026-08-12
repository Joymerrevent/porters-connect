// XML on the wire: parse what the library sends (Write body) and build what PORTERS answers
// (Read page / Write result / error envelopes / Authentication).
//
// The shapes are the ones the library actually contracts on, so they are derived from its own
// modules rather than re-typed here: the Read envelope is what `parseResourcePage` eats, the Write
// result what `parseWriteResult` eats, the Authentication envelope what `parseAuthentication` eats,
// and the per-Data-Type nesting is the inverse of `decodeField` (`src/xml/decode.ts`). Read and
// Write are asymmetric (write-format.md): User/Reference write an ID but read back nested, Option
// writes bare aliases but reads back under `<OptionRoot>`.

import { XMLParser } from "fast-xml-parser";

import type { DataType } from "../../src/xml/decode";
import { asArray, asRecord, asString } from "../../src/xml/raw";
import type { FakeMasters } from "./masters";
import type { FakeRecord, FakeValue } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  ignoreDeclaration: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => name === "Item",
});

const DECLARATION = `<?xml version="1.0" encoding="UTF-8"?>`;

// The 4 readable sub-fields of a User field (docs/reference) — what a Read returns when the
// caller does not narrow `Person.P_Owner(...)` itself.
const USER_SUBFIELDS = ["P_Id", "P_Type", "P_Name", "P_Mail"] as const;

// Element-content escaping, mirroring `src/xml/encode.ts`: only `& < >` matter in PCDATA and the
// fake emits no attribute values.
const escapeXml = (s: string): string =>
  s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );

const element = (tag: string, inner: string): string =>
  inner === "" ? `<${tag} />` : `<${tag}>${inner}</${tag}>`;

// `{prefix}.{alias}` for the data resources; the bespoke Attachment has no prefix, so its tags are
// the bare field names (`<FileName>`, not `<Attachment.FileName>`) — ADR-0018.
const qualify = (prefix: string, alias: string): string =>
  prefix === "" ? alias : `${prefix}.${alias}`;

/** One `field=` entry: the bare alias plus any narrowed sub-fields (`Person.P_Owner(User.P_Id)`). */
export type FieldSelection = { alias: string; sub: string[] };

/** A Write request body, parsed back into bare aliases. */
export type ParsedWriteBody = { resource: string; items: FakeRecord[] };

// One Write `<Item>`'s children -> bare alias -> value. A scalar stays a string; an Option field
// arrives as `<Field><Option.A/><Option.B/></Field>`, i.e. a record whose *keys* are the selected
// aliases (fast-xml-parser gives empty elements an empty-string value).
const parseWriteItem = (raw: unknown, prefix: string): FakeRecord => {
  const item = asRecord(raw) ?? {};
  const out: FakeRecord = {};
  for (const [key, value] of Object.entries(item)) {
    const alias = key.startsWith(`${prefix}.`)
      ? key.slice(prefix.length + 1)
      : key;
    const scalar = asString(value);
    if (scalar !== undefined) {
      out[alias] = scalar;
      continue;
    }
    const nested = asRecord(value);
    // An empty element parses to `""` (handled above) — a record here is the Option shape.
    if (nested) out[alias] = Object.keys(nested);
  }
  return out;
};

/**
 * Parse a Write request body (`buildWriteXml`'s output). Returns `undefined` when the payload is
 * not a `<{Resource}><Item>…` envelope at all — the caller answers with a Result Code rather than
 * guessing (fail-safe).
 */
export const parseWriteBody = (
  xml: string,
  prefix: string,
): ParsedWriteBody | undefined => {
  const root = asRecord(parser.parse(xml) as unknown);
  const resource = root ? Object.keys(root)[0] : undefined;
  const body = root && resource ? asRecord(root[resource]) : undefined;
  if (resource === undefined || body === undefined) return undefined;
  return {
    resource,
    items: asArray(body.Item).map((raw) => parseWriteItem(raw, prefix)),
  };
};

// --- Read response --------------------------------------------------------------------------

// A `User` field reads back as `<Field><User><User.P_Id>…</User.P_Id>…</User></Field>` — the ID-only
// write shape expanded through the User master.
const userInner = (masters: FakeMasters, id: string, sub: string[]): string => {
  const entry = masters.user(id);
  const wanted = sub.length > 0 ? sub : USER_SUBFIELDS.map((s) => `User.${s}`);
  const children = wanted
    .map((name) => {
      const bare = name.slice(name.lastIndexOf(".") + 1);
      const value = entry[bare as keyof typeof entry];
      return value === undefined ? "" : element(name, escapeXml(value));
    })
    .join("");
  return element("User", children);
};

/**
 * How an Option-typed field nests on read:
 * - `root` — the data resources: `<OptionRoot><Alias><Option.P_Id/><Option.P_Name/></Alias></OptionRoot>`
 * - `bare` — Field master's `P_ReferTo`: `<Field.P_ReferTo><Option.P_Area/></Field.P_ReferTo>`
 *   (ADR-0022 fact 6 — no wrapper, no children). `decodeOption` tolerates both.
 */
export type OptionShape = "root" | "bare";

// An `Option` field reads back as the selected leaf aliases, each carrying its id + display name
// (reference: Read レスポンス XML). Only the alias round-trips (ADR-0017).
const optionInner = (
  masters: FakeMasters,
  aliases: string[],
  shape: OptionShape,
): string => {
  if (shape === "bare") {
    return aliases.map((alias) => element(alias, "")).join("");
  }
  const children = aliases
    .map((alias) => {
      const entry = masters.option(alias);
      return element(
        alias,
        element("Option.P_Id", entry.id) +
          element("Option.P_Name", escapeXml(entry.name)),
      );
    })
    .join("");
  return element("OptionRoot", children);
};

// `System[Reference]` reads back as a nested record whose own `P_Id` is the referenced id. The
// referenced *resource* name is not in the Data-Type catalog, so the fake emits a neutral wrapper —
// `decodeReference` reads the first record-valued child's `P_Id`, which this satisfies.
// VERIFY(live): the real tag is the referenced resource (e.g. `<Candidate>`); see LV-10.
const referenceInner = (id: string): string =>
  element("Reference", element("P_Id", escapeXml(id)));

const fieldInner = (
  masters: FakeMasters,
  type: DataType | undefined,
  value: FakeValue,
  sub: string[],
  optionShape: OptionShape,
): string => {
  if (Array.isArray(value)) return optionInner(masters, value, optionShape);
  switch (type) {
    case "Option":
      // A single selection may have been stored as a bare alias — normalise to the read shape.
      return optionInner(masters, [value], optionShape);
    case "User":
      return userInner(masters, value, sub);
    case "System[Reference]":
      return referenceInner(value);
    default:
      // Ids, numbers, text and the date/time types are already in wire format (the library
      // normalised ISO -> PORTERS on write); custom `U_`/`A_` aliases pass through likewise.
      return escapeXml(value);
  }
};

/** How to render a record's fields: the alias prefix, the catalog, and the Option nesting. */
export type ItemShape = {
  prefix: string;
  fields: Readonly<Record<string, DataType>>;
  masters: FakeMasters;
  /** Default `root`. */
  optionShape?: OptionShape;
};

/**
 * Render one stored record as an `<Item>`, limited to the selected fields. `nested` is appended
 * verbatim inside the item — the Option master uses it for its recursive `<Items>` collection.
 */
export const buildItemXml = (
  shape: ItemShape,
  record: FakeRecord,
  selection: FieldSelection[],
  nested = "",
): string => {
  const children = selection
    .map(({ alias, sub }) => {
      const tag = qualify(shape.prefix, alias);
      const value = record[alias];
      // A requested-but-unset field comes back as an empty element (see the reference's own
      // sample) — the library decodes that to `null`.
      if (value === undefined) return element(tag, "");
      // A tenant's custom `U_`/`A_` field is not in the static catalog (it is declared with
      // `defineFields` — ADR-0023), so its Data Type has to come from the request: the library
      // asks for a User-typed field as `alias(User.P_Id,…)`, and nothing else nests like that.
      const declaredUser =
        sub.length > 0 && sub.every((name) => name.startsWith("User."));
      const type =
        shape.fields[alias] ?? (declaredUser ? ("User" as const) : undefined);
      return element(
        tag,
        fieldInner(
          shape.masters,
          type,
          value,
          sub,
          shape.optionShape ?? "root",
        ),
      );
    })
    .join("");
  return element("Item", children + nested);
};

/**
 * Build a Read page. The standard envelope carries `Total`/`Count`/`Start`; the Option master
 * answers with `<Code>` and a recursive `<Items>` tree instead, so `paging: false` drops the
 * attributes (ADR-0022 fact 5). `items` lets a caller pass pre-rendered `<Item>`s (the tree).
 */
export const buildReadPageXml = (args: {
  resource: string;
  shape: ItemShape;
  records?: FakeRecord[];
  selection?: FieldSelection[];
  items?: string;
  total?: number;
  start?: number;
  paging?: boolean;
}): string => {
  const items =
    args.items ??
    (args.records ?? [])
      .map((record) => buildItemXml(args.shape, record, args.selection ?? []))
      .join("");
  const count = args.records?.length ?? 0;
  const attributes =
    args.paging === false
      ? ""
      : ` Total="${args.total ?? count}" Count="${count}" Start="${args.start ?? 0}"`;
  return (
    `${DECLARATION}<${args.resource}${attributes}>` +
    `<Code>0</Code>${items}</${args.resource}>`
  );
};

/**
 * Build a Write result: one `<Item><Id/><Code/></Item>` per sent record, same order and count
 * (write-format.md — the library asserts that count in `runBulkWrite`).
 */
export const buildWriteResultXml = (
  resource: string,
  results: { id: number; code: number }[],
): string => {
  const items = results
    .map((r) =>
      element(
        "Item",
        element("Id", String(r.id)) + element("Code", String(r.code)),
      ),
    )
    .join("");
  return `${DECLARATION}<${resource}>${items}</${resource}>`;
};

/** Build a Resource API error envelope (root `<Code>` ≠ 0). */
export const buildResourceErrorXml = (
  resource: string,
  code: number,
  message: string,
): string =>
  `${DECLARATION}<${resource}><Code>${code}</Code>` +
  `<Message>${escapeXml(message)}</Message></${resource}>`;

/** Build an `<Authentication>` envelope from the given children, in order. */
export const buildAuthenticationXml = (
  entries: Record<string, string>,
): string => {
  const children = Object.entries(entries)
    .map(([tag, value]) => element(tag, escapeXml(value)))
    .join("");
  return `${DECLARATION}<Authentication>${children}</Authentication>`;
};
