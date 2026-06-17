// Shared Read internals for every resource — data (resource.ts) and master
// (partition/user/field/option). Owns catalog typing, the catalog-driven item decoder, the
// GET+parse+decode runner, and offset pagination. Data resources add Write on top; master
// resources add bespoke query/URL building (ADR-0021/0022). XML stays in xml/ — this only
// wires parse + decode together.

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
export type FieldCatalog = Record<string, DataType>;

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

/**
 * Build a catalog-driven item decoder: known `P_` fields decode by their Data Type, unknown
 * `U_`/`A_` aliases pass through (raw string, or null when nested). `bareAlias` strips the
 * `{prefix}.` so `Person.P_Name` and `P_Name` both hit the catalog.
 */
export const decoderFor = <F extends FieldCatalog>(
  fields: F,
): ((item: RawItem) => ReadRecord<F>) => {
  const fieldMap = new Map<string, DataType>(Object.entries(fields));
  return (item) => {
    const out: Record<string, FieldValue> = {};
    for (const [key, raw] of Object.entries(item)) {
      const alias = bareAlias(key);
      const type = fieldMap.get(alias);
      out[alias] = type
        ? decodeField(type, raw)
        : typeof raw === "string"
          ? raw
          : null;
    }
    return out as ReadRecord<F>;
  };
};

/** GET a Read URL, parse the standard envelope (Total/Count/Start + Items), decode each item. */
export const runRead = <F extends FieldCatalog>(
  requester: Requester,
  url: string,
  decode: (item: RawItem) => ReadRecord<F>,
): Promise<ResourcePage<F>> =>
  requester.request({ method: "GET", url, headers: {} }, (body) => {
    const page = parseResourcePage(body);
    return {
      items: page.items.map(decode),
      total: page.total,
      count: page.count,
      start: page.start,
    };
  });

// Read max page size (docs/reference: count 1–200). searchAll pages by this.
const PAGE_SIZE = 200;

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
