// Typed Read query surface (ADR-0038 / F-2): condition / order / keywords / itemstate, grounded in
// the PORTERS Read parameter reference. The public types are Data-Type-aware — a field's allowed
// operators and value shape derive from its catalog Data Type (ADR-0005 R-5 / ADR-0038 案1a). The
// encoder turns a typed query into the wire params, normalising dates ISO -> PORTERS and guarding
// the caller-side limits (keywords length, itemstate condition restriction) before send (fail-safe).
// XML/value formatting stays in xml/; this owns only the Read query string.

import { PortersConfigError } from "../errors";
import { isoToPortersDate, isoToPortersDateTime } from "../util/datetime";
import type { DataType } from "../xml/decode";
import type { FieldCatalog } from "./read-core";

// --- condition: per-Data-Type operator objects (reference: Read - Condition) ---

/** Comparable ops for numeric Ids (System[Id]); `or` matches a set of Resource Ids (`P_Id:or=1:2`). */
type IdCondition = {
  gt?: number;
  ge?: number;
  eq?: number;
  le?: number;
  lt?: number;
  or?: number[];
};

/** Comparable ops for Number. */
type NumberCondition = {
  gt?: number;
  ge?: number;
  eq?: number;
  le?: number;
  lt?: number;
};

/** Comparable ops for date/time fields. Values are ISO 8601 (UTC `…Z`); normalised to PORTERS on send. */
type TemporalCondition = {
  gt?: string;
  ge?: string;
  eq?: string;
  le?: string;
  lt?: string;
};

/** Text match. `full` = exact, `part` = substring (PORTERS default). */
type TextCondition = {
  full?: string;
  part?: string;
};

/** Option-select match; values are option aliases (e.g. `Option.P_SE`), OR/AND-joined. */
type OptionCondition = {
  or?: string[];
  and?: string[];
};

/** Link/reference match by id (User / System[Reference]): `eq` one id, or OR/AND a set of ids. */
type ReferenceCondition = {
  eq?: number;
  or?: number[];
  and?: number[];
};

/** The condition-operator object a field of Data Type `D` accepts. */
type ConditionFor<D extends DataType> = D extends "System[Id]"
  ? IdCondition
  : D extends "Number"
    ? NumberCondition
    : D extends "DateTime" | "System[DateTime]" | "Date" | "Age"
      ? TemporalCondition
      : D extends
            | "SinglelineText"
            | "MultilineText"
            | "Mail"
            | "Telephone"
            | "URL"
        ? TextCondition
        : D extends "Option"
          ? OptionCondition
          : D extends "User" | "System[Reference]"
            ? ReferenceCondition
            : never;

/**
 * A typed search condition over a catalog: each field maps to the operator object its Data Type
 * allows (ADR-0038 案1a). Multiple fields are AND-joined (reference). Unknown aliases / wrong
 * operators are type errors. Custom `U_`/`A_` fields are not in the catalog — condition on them via
 * a cast (the encoder passes unknown aliases through as raw scalars, like read/write).
 */
export type Condition<F extends FieldCatalog> = {
  [K in keyof F]?: ConditionFor<F[K]>;
};

// --- order (reference: Read - Order; only Number/Currency/Age/Date/DateTime/System are sortable) ---

type OrderableDataType =
  | "System[Id]"
  | "System[DateTime]"
  | "Number"
  | "DateTime"
  | "Date"
  | "Age";

type OrderableKeys<F extends FieldCatalog> = {
  [K in keyof F]: F[K] extends OrderableDataType ? K : never;
}[keyof F];

/**
 * Sort spec: an ordered list of `{ field: "asc" | "desc" }`, encoded in array (then key) order. Only
 * orderable Data Types (Number/Date/DateTime/Age/System) are accepted (reference).
 */
export type Order<F extends FieldCatalog> = Array<
  Partial<Record<OrderableKeys<F>, "asc" | "desc">>
>;

// --- itemstate (reference: 削除済みデータ取得) ---

/**
 * Which delete state to read. Omitting (or `existing`) reads live data; `deleted`/`all` read deleted
 * records — the only way to read deleted data, since there is no delete API. When `deleted`/`all`,
 * condition is restricted to `P_Id` / `P_UpdateDate` / `P_UpdatedBy` and PORTERS auto-adds a
 * "updated within 90 days" filter (`P_UpdateDate` = the delete time, `P_UpdatedBy` = the last editor).
 */
export type ItemState = "existing" | "deleted" | "all";

// --- the public query shape (moved here from resource.ts; data resources parametrise over their catalog) ---

export type SearchQuery<F extends FieldCatalog = FieldCatalog> = {
  /**
   * Output fields as prefixed aliases (e.g. `Person.P_Name`). **Omit** to fetch every catalogued
   * field by default (ADR-0020): PORTERS returns only the primary key for a fieldless request, so
   * the library sends a catalog-derived default field set instead. Pass `[]` to opt into that
   * API-native "primary key only" response (e.g. counting). A non-empty list is sent verbatim.
   */
  field?: string[];
  /** Typed AND-conditions; each field's operators derive from its Data Type (ADR-0038). */
  condition?: Condition<F>;
  /** Sort order; orderable Data Types only (Number/Date/DateTime/Age/System). */
  order?: Order<F>;
  /**
   * Keyword AND-search over text fields (MultilineText/SinglelineText/Mail/URL; Telephone digits
   * only). OR is not supported. Max 100 characters including commas — guarded before send.
   */
  keywords?: string[];
  /** Delete-state filter (default `existing`). `deleted`/`all` restrict `condition` — see {@link ItemState}. */
  itemstate?: ItemState;
  count?: number;
  start?: number;
};

// --- encoder (typed query -> wire params) ---

const KEYWORDS_MAX_CHARS = 100;
// itemstate=deleted/all restricts condition to these standard fields (reference / 削除済みデータ取得).
const DELETED_CONDITION_FIELDS = new Set([
  "P_Id",
  "P_UpdateDate",
  "P_UpdatedBy",
]);

/** Output context for prefixing aliases and resolving each field's Data Type. */
type QueryContext = {
  prefix: string;
  fields: ReadonlyMap<string, DataType>;
};

/**
 * Serialise one condition value by the field's Data Type: dates ISO -> PORTERS, arrays (Option
 * aliases / id sets) colon-joined, everything else stringified. Unknown alias (no Data Type) ->
 * raw scalar, mirroring read/write passthrough.
 */
const serializeConditionValue = (
  type: DataType | undefined,
  value: unknown,
): string => {
  if (Array.isArray(value)) return value.map(String).join(":");
  if (type === "DateTime" || type === "System[DateTime]") {
    return isoToPortersDateTime(String(value));
  }
  if (type === "Date" || type === "Age") return isoToPortersDate(String(value));
  return String(value);
};

// condition -> `Prefix.alias:suffix=value,...`. Throws if itemstate=deleted/all names a field
// outside P_Id/P_UpdateDate/P_UpdatedBy (PORTERS would 400 — fail fast before send). Typed over the
// loose catalog: `Condition<F>` is assignable in, and the encoding is purely structural.
const encodeCondition = (
  condition: Condition<FieldCatalog>,
  itemstate: ItemState | undefined,
  ctx: QueryContext,
): string => {
  const restricted = itemstate === "deleted" || itemstate === "all";
  const parts: string[] = [];
  for (const [alias, ops] of Object.entries(condition)) {
    if (ops === undefined) continue;
    if (restricted && !DELETED_CONDITION_FIELDS.has(alias)) {
      throw new PortersConfigError(
        `condition field "${alias}" is not allowed when itemstate is "${itemstate}"`,
        {
          category: "config",
          hint: "Deleted reads (itemstate deleted/all) accept only P_Id, P_UpdateDate, P_UpdatedBy in condition.",
        },
      );
    }
    const type = ctx.fields.get(alias);
    for (const [suffix, value] of Object.entries(ops)) {
      if (value === undefined) continue;
      parts.push(
        `${ctx.prefix}.${alias}:${suffix}=${serializeConditionValue(type, value)}`,
      );
    }
  }
  return parts.join(",");
};

// order -> `Prefix.alias:dir,...` in array (then key) order. Loosely typed (Order<F> assigns in);
// `Order<FieldCatalog>` collapses its value type, so read each spec's entries as directions.
const encodeOrder = (order: Order<FieldCatalog>, ctx: QueryContext): string => {
  const parts: string[] = [];
  for (const spec of order) {
    const dirs = spec as Record<string, "asc" | "desc" | undefined>;
    for (const [alias, dir] of Object.entries(dirs)) {
      if (dir === undefined) continue;
      parts.push(`${ctx.prefix}.${alias}:${dir}`);
    }
  }
  return parts.join(",");
};

/**
 * Set the typed Read query params (condition / order / keywords / itemstate) on `p`. Universal
 * params (partition / field / count / start) stay in `buildReadUrl`. Throws `PortersConfigError`
 * for caller-side misuse (keywords too long, itemstate-restricted condition) before any request.
 */
export const appendReadQuery = <F extends FieldCatalog>(
  p: URLSearchParams,
  q: SearchQuery<F>,
  ctx: QueryContext,
): void => {
  if (q.condition) {
    const cond = encodeCondition(q.condition, q.itemstate, ctx);
    if (cond.length > 0) p.set("condition", cond);
  }
  if (q.order) {
    const order = encodeOrder(q.order, ctx);
    if (order.length > 0) p.set("order", order);
  }
  if (q.keywords && q.keywords.length > 0) {
    const kw = q.keywords.join(",");
    if (kw.length > KEYWORDS_MAX_CHARS) {
      throw new PortersConfigError(
        `keywords is ${kw.length} characters, over the ${KEYWORDS_MAX_CHARS}-character limit`,
        {
          category: "config",
          hint: "Shorten keywords: PORTERS caps the keyword search at 100 characters including commas.",
        },
      );
    }
    p.set("keywords", kw);
  }
  // `existing` is the API default — omit it to keep URLs minimal (and stable vs. pre-F-2 reads).
  if (q.itemstate !== undefined && q.itemstate !== "existing") {
    p.set("itemstate", q.itemstate);
  }
};
