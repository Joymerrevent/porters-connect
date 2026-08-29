// Shared Read internals for every resource — data (resource.ts) and master
// (partition/user/field/option). Owns catalog typing, the catalog-driven item decoder, the
// GET+parse+decode runner, and offset pagination. Data resources add Write on top; master
// resources add bespoke query/URL building (ADR-0021/0022). XML stays in xml/ — this only
// wires parse + decode together.

import { PortersConfigError } from "../errors";
import type { AccessPoint } from "../http/access-point";
import type { Requester } from "../http/requester";
import {
  decodeField,
  type DataType,
  type DecodedValue,
  type FieldValue,
} from "../xml/decode";
import { parseResourcePage, type RawItem } from "../xml/parser";

// A field catalog: bare alias -> Data Type. Declared `as const` per resource so the static
// Read/Write types derive from it — the catalog is the single source of truth (ADR-0019).
//
// `null` means **PORTERS assigns this field no Data Type** — the reference's own `ー` (ADR-0056).
// It is not "unset" / "unknown" / "to be decided", and it is not a new Data Type: it records an
// absence the reference states. Today that is `P_Deleted` (Read-`field`-only: PORTERS rejects it in
// condition / order / Write). Because every derivation runs off `keyof F`, `null` falls out of
// `WritableKeys` / `OrderableKeys` and lands on `ConditionFor`'s `never` — the three restrictions
// hold in the type system with no extra code.
export type FieldCatalog = Record<string, DataType | null>;

/**
 * What every resource accessor is handed: how to send (requester), where to send (access point —
 * ADR-0047), and the partition it is bound to. Partition Read takes `Omit<…, "partition">`: it
 * discovers partitions, so it has none to bind.
 */
export type ResourceDeps = {
  requester: Requester;
  accessPoint: AccessPoint;
  partition: number;
};

/**
 * "No custom fields": the intersection-identity default for the generic catalog params (ADR-0023).
 * A bare `{}` is flagged by `no-empty-object-type`; `Record<never, never>` is the same empty object,
 * lint-clean, adds no keys in `static & C`, and satisfies both `FieldCatalog` and `DeclaredCatalogs`.
 * Lives here (with `FieldCatalog`) so resources need not import from the higher-level `fields/` (RV-8).
 */
export type EmptyCatalog = Record<never, never>;

/**
 * A decoded record: every known field, each `DecodedValue | null`, and **optional** because a
 * field not named in `field` is simply absent (SD-3 "simple" type — ADR-0005/0019). Custom
 * `U_`/`A_` aliases are not in the catalog, so they are not typed here (access via a cast until
 * the declaration DSL lands — ADR-0005 SD-2); at runtime they still pass through as raw values.
 */
export type ReadRecord<F extends FieldCatalog> = {
  [K in keyof F]?: DecodedValue<F[K]> | null;
};

export type ResourcePage<F extends FieldCatalog> = {
  items: ReadRecord<F>[];
  total: number;
  count: number;
  start: number;
};

// `includes(".")` -> `includes("")` is an equivalent mutant: for a dotless key,
// slice(indexOf(".") + 1) is slice(0), which equals the key — same as the else.
// Stryker disable StringLiteral
const bareAlias = (key: string): string =>
  key.includes(".") ? key.slice(key.indexOf(".") + 1) : key;
// Stryker restore StringLiteral

// --- Read `field` assembly (ADR-0020) -------------------------------------------------------

// The 4 readable sub-fields of a User-type field (docs/reference: only these are returned).
const USER_SUBFIELDS = ["P_Id", "P_Type", "P_Name", "P_Mail"] as const;

// One `field=` entry for a bare alias. PORTERS wants `{prefix}.{alias}`; a User-typed field is
// expanded to its 4 readable sub-fields so the wire shape matches `decodeUser` — asking for it
// without `()` would return an id, and the typed record promises a `UserRef`. An alias the catalog
// does not know (a tenant `U_`/`A_` field) is prefixed and left alone.
const readFieldEntry = (
  prefix: string,
  alias: string,
  type: DataType | null | undefined,
): string =>
  type === "User"
    ? `${prefix}.${alias}(${USER_SUBFIELDS.map((s) => `User.${s}`).join(",")})`
    : `${prefix}.${alias}`;

/**
 * The default Read `field` list, derived from the catalog (ADR-0020, 案A+2a). PORTERS returns only
 * `{Resource}.P_Id` for a fieldless request, so a typed-record read would otherwise drop every
 * known field despite the type promising them. Every catalog alias is sent, User expanded and
 * System[Reference] left ID-only (`()` omitted) so the wire shape matches decode.ts. The API-native
 * "primary key only" stays reachable via `field: []` (透明化 — see `SearchQuery.field`).
 */
export const defaultReadFields = (
  prefix: string,
  fields: ReadonlyMap<string, DataType | null>,
): string[] =>
  [...fields].map(([alias, type]) => readFieldEntry(prefix, alias, type));

/**
 * Build a catalog-driven item decoder: catalogued `P_` fields decode by their Data Type (`null` =
 * no Data Type -> raw string), unknown `U_`/`A_` aliases pass through (raw string, or null when
 * nested). `bareAlias` strips the `{prefix}.` so `Person.P_Name` and `P_Name` both hit the catalog.
 */
export const decoderFor = <F extends FieldCatalog>(
  fields: F,
): ((item: RawItem) => ReadRecord<F>) => {
  const fieldMap = new Map<string, DataType | null>(Object.entries(fields));
  return (item) => {
    const out: Record<string, FieldValue> = {};
    for (const [key, raw] of Object.entries(item)) {
      const alias = bareAlias(key);
      // Catalog values are `DataType | null`, never undefined — so `undefined` here means
      // "not in the catalog" and only that. A catalogued `null` goes through `decodeField`,
      // which passes the raw string on (ADR-0056).
      const type = fieldMap.get(alias);
      out[alias] =
        type === undefined
          ? typeof raw === "string"
            ? raw
            : null
          : decodeField(type, raw);
    }
    return out as ReadRecord<F>;
  };
};

/**
 * GET a Read URL, parse the standard envelope (Total/Count/Start + Items), decode each item.
 * `resource` is the expected root element — the parser needs it to tell a PORTERS answer from
 * whatever a middlebox put on a 200 (ADR-0051).
 */
export const runRead = <F extends FieldCatalog>(
  requester: Requester,
  resource: string,
  url: string,
  decode: (item: RawItem) => ReadRecord<F>,
): Promise<ResourcePage<F>> =>
  requester.request({ method: "GET", url, headers: {} }, (body) => {
    const page = parseResourcePage(body, resource);
    return {
      items: page.items.map(decode),
      total: page.total,
      count: page.count,
      start: page.start,
    };
  });

// Read page size bounds (docs/reference: `count` is 1–200, default 10). `searchAll` pages by MAX.
const MIN_READ_COUNT = 1;
const MAX_READ_COUNT = 200;
const PAGE_SIZE = MAX_READ_COUNT;

/**
 * Set the universal paging params, guarding `count` against the documented 1–200 range before the
 * request goes out (RV-28). Out-of-range values would otherwise reach PORTERS and come back as an
 * opaque response; this is the same "fail early with a clear config error" series as the keyword
 * length / itemstate / request-size guards. Shared by every Read path (data + master + attachment)
 * so the rule lives in one place. Callers are `async`, so this rejects rather than throwing
 * synchronously (ADR-0046).
 */
export const appendPaging = (
  p: URLSearchParams,
  count?: number,
  start?: number,
): void => {
  if (count !== undefined) {
    if (
      !Number.isInteger(count) ||
      count < MIN_READ_COUNT ||
      count > MAX_READ_COUNT
    ) {
      throw new PortersConfigError(
        `count must be an integer between ${MIN_READ_COUNT} and ${MAX_READ_COUNT}, got ${count}`,
        {
          category: "config",
          hint: `PORTERS returns 1–${MAX_READ_COUNT} records per Read. Use searchAll() to walk every page instead of raising count.`,
        },
      );
    }
    p.set("count", String(count));
  }
  if (start !== undefined) p.set("start", String(start));
};

/**
 * Offset pagination shared by every `searchAll`. Advances by the items actually returned and
 * stops at `total` — or on an empty page (defensive against a stuck offset / infinite loop).
 * A generator can't be an arrow; a function expression still satisfies func-style:expression.
 */
export const paginate = async function* <T>(
  fetchPage: (
    count: number,
    start: number,
  ) => Promise<{ items: T[]; total: number }>,
): AsyncGenerator<T> {
  let start = 0;
  for (;;) {
    const page = await fetchPage(PAGE_SIZE, start);
    for (const item of page.items) yield item;
    start += page.items.length;
    if (page.items.length === 0 || start >= page.total) return;
  }
};
