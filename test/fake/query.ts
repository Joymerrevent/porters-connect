// Read query: parse the URL the library builds (`buildReadUrl` + `appendReadQuery`) and apply it
// to the store — field selection, condition, order, keywords, itemstate and offset paging.
//
// Grounded in docs/reference (Resource API 概要 / Read パラメータ). Matching is deliberately shallow
// where PORTERS' own semantics are business logic (relevance, collation): text `part` is a plain
// substring match, ordering a plain value comparison. That is the "業務面は浅い" half of ADR-0043.

import type { DataType } from "../../src/xml/decode";
import type { FieldSelection } from "./wire";
import type { FakeRecord, FakeValue } from "./types";

/** One `condition=` term: `Person.P_Name:part=山田` -> alias `P_Name`, op `part`, value `山田`. */
export type ParsedCondition = { alias: string; op: string; value: string };

/** One `order=` term. */
export type ParsedOrder = { alias: string; direction: "asc" | "desc" };

export type ReadQuery = {
  partition: string | null;
  selection: FieldSelection[];
  conditions: ParsedCondition[];
  order: ParsedOrder[];
  keywords: string[];
  itemstate: string;
  count: number;
  start: number;
};

// Read `count` is 1–200 (reference); the library pages by 200.
const MAX_COUNT = 200;

const NUMERIC_TYPES = new Set<DataType>([
  "System[Id]",
  "Number",
  "User",
  "System[Reference]",
]);

// Split on top-level commas only: a `field` entry may carry a parenthesised sub-selection
// (`Person.P_Owner(User.P_Id,User.P_Name)`) whose commas are not separators.
const splitTopLevel = (value: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.filter((p) => p.length > 0);
};

const bareAlias = (name: string, prefix: string): string =>
  name.startsWith(`${prefix}.`) ? name.slice(prefix.length + 1) : name;

const parseFieldList = (value: string, prefix: string): FieldSelection[] =>
  splitTopLevel(value).map((entry) => {
    const open = entry.indexOf("(");
    if (open === -1) return { alias: bareAlias(entry, prefix), sub: [] };
    const name = entry.slice(0, open);
    const inner = entry.slice(open + 1, entry.lastIndexOf(")"));
    return { alias: bareAlias(name, prefix), sub: splitTopLevel(inner) };
  });

const parseConditions = (value: string, prefix: string): ParsedCondition[] =>
  splitTopLevel(value).flatMap((term) => {
    const eq = term.indexOf("=");
    const colon = term.indexOf(":");
    if (eq === -1 || colon === -1 || colon > eq) return [];
    return [
      {
        alias: bareAlias(term.slice(0, colon), prefix),
        op: term.slice(colon + 1, eq),
        value: term.slice(eq + 1),
      },
    ];
  });

const parseOrder = (value: string, prefix: string): ParsedOrder[] =>
  splitTopLevel(value).flatMap((term) => {
    const colon = term.lastIndexOf(":");
    if (colon === -1) return [];
    const direction = term.slice(colon + 1);
    if (direction !== "asc" && direction !== "desc") return [];
    return [{ alias: bareAlias(term.slice(0, colon), prefix), direction }];
  });

const intParam = (
  params: URLSearchParams,
  key: string,
  fallback: number,
): number => {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Parse a Read URL. A missing/empty `field` means the API-native "primary key only" response
 * (ADR-0020) — the library only omits `field` when the caller passed `[]`.
 */
export const parseReadQuery = (url: URL, prefix: string): ReadQuery => {
  const params = url.searchParams;
  const field = params.get("field");
  const condition = params.get("condition");
  const order = params.get("order");
  const keywords = params.get("keywords");
  return {
    partition: params.get("partition"),
    selection:
      field === null || field === ""
        ? [{ alias: "P_Id", sub: [] }]
        : parseFieldList(field, prefix),
    conditions: condition === null ? [] : parseConditions(condition, prefix),
    order: order === null ? [] : parseOrder(order, prefix),
    keywords: keywords === null || keywords === "" ? [] : keywords.split(","),
    itemstate: params.get("itemstate") ?? "existing",
    count: Math.min(intParam(params, "count", MAX_COUNT), MAX_COUNT),
    start: intParam(params, "start", 0),
  };
};

// --- matching -------------------------------------------------------------------------------

const asList = (value: FakeValue): string[] =>
  Array.isArray(value) ? value : [value];

const compare = (left: string, right: string, numeric: boolean): number => {
  if (numeric) return Number(left) - Number(right);
  // Date/DateTime wire formats (`yyyy/mm/dd[ HH:MM:SS]`) sort chronologically as plain strings.
  return left < right ? -1 : left > right ? 1 : 0;
};

const matchCondition = (
  record: FakeRecord,
  condition: ParsedCondition,
  type: DataType | undefined,
): boolean => {
  const value = record[condition.alias];
  if (value === undefined) return false;
  const numeric = type !== undefined && NUMERIC_TYPES.has(type);
  const selected = asList(value);
  // `or` / `and` take colon-joined sets (Option aliases, or ids for Link/User/Reference).
  const wanted = condition.value.split(":");
  switch (condition.op) {
    case "or":
      return wanted.some((w) => selected.includes(w));
    case "and":
      return wanted.every((w) => selected.includes(w));
    case "full":
      return selected.some((v) => v === condition.value);
    case "part":
      return selected.some((v) => v.includes(condition.value));
    case "eq":
      return selected.some((v) => compare(v, condition.value, numeric) === 0);
    case "gt":
      return compare(selected[0], condition.value, numeric) > 0;
    case "ge":
      return compare(selected[0], condition.value, numeric) >= 0;
    case "le":
      return compare(selected[0], condition.value, numeric) <= 0;
    case "lt":
      return compare(selected[0], condition.value, numeric) < 0;
    default:
      return false;
  }
};

// Keyword search is an AND over the record's text values (reference: OR is not supported).
const matchKeywords = (record: FakeRecord, keywords: string[]): boolean =>
  keywords.every((keyword) =>
    Object.values(record).some((value) =>
      asList(value).some((v) => v.includes(keyword)),
    ),
  );

/**
 * Apply a parsed query to a resource's records: filter, sort, then page. Returns the matching
 * total (before paging) alongside the page itself, mirroring `Total` vs `Count`.
 */
export const runReadQuery = (
  records: FakeRecord[],
  query: ReadQuery,
  fields: Readonly<Record<string, DataType>>,
): { items: FakeRecord[]; total: number } => {
  // There is no delete API, so nothing is ever in the "deleted" state: `deleted` reads empty and
  // `all` equals `existing` (docs/reference: itemstate exists only to reach deleted records).
  if (query.itemstate === "deleted") return { items: [], total: 0 };
  const matched = records.filter(
    (record) =>
      query.conditions.every((c) =>
        matchCondition(record, c, fields[c.alias]),
      ) && matchKeywords(record, query.keywords),
  );
  const sorted = [...matched].sort((a, b) => {
    for (const { alias, direction } of query.order) {
      const left = a[alias];
      const right = b[alias];
      if (left === undefined || right === undefined) continue;
      const numeric = NUMERIC_TYPES.has(fields[alias]);
      const diff = compare(asList(left)[0], asList(right)[0], numeric);
      if (diff !== 0) return direction === "asc" ? diff : -diff;
    }
    return 0;
  });
  return {
    items: sorted.slice(query.start, query.start + query.count),
    total: sorted.length,
  };
};
