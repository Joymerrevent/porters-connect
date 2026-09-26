// Turning a typed Read query into the wire params: condition / order / keywords / itemstate,
// normalising dates ISO -> PORTERS and guarding the caller-side limits (keywords length, itemstate
// condition restriction) before send (fail-safe), plus the whole query -> parameters for a data
// resource's Read. The query types themselves are `query.ts`. XML/value formatting stays in xml/;
// this owns only the Read query string.

import { PortersConfigError } from "../errors";
import { qualify } from "../util/alias";
import {
  isoExample,
  isoToPortersDate,
  isoToPortersDateTime,
} from "../util/datetime";
import type { DataType } from "../porters/data-type";
import type { AccessPoint } from "../http/access-point";
import type { ReferenceMap } from "./expand";
import { fieldParam, type FieldParamContext } from "./field-param";
import { readUrlOf } from "./read";
import type { FieldCatalog } from "./catalog";
import type { Paging } from "./paging";
import type { Condition, ItemState, Order, SearchQuery } from "./query";
import {
  DELETED_CONDITION_FIELDS,
  KEYWORDS_MAX_CHARS,
} from "../porters/read-rules";

// The keyword cap and the fields a deleted read may condition on are PORTERS values (porters/read-rules.ts).

/** Output context for prefixing aliases and resolving each field's Data Type. */
type QueryContext = {
  prefix: string;
  fields: ReadonlyMap<string, DataType | null>;
};

// A condition value that cannot be converted (RV-36). Same reasoning as the write side: the value
// came from the caller, so `PortersConfigError`; the failure is a format one, so
// `category: "validation"`. Without this the raw `RangeError` from `isoToPorters*` escapes the
// PortersError family, which is what the error-handling guide tells callers to branch on.
const convertedForQuery = (
  alias: string,
  type: DataType,
  value: unknown,
  convert: () => string,
): string => {
  try {
    return convert();
  } catch (cause) {
    throw new PortersConfigError(
      `condition ${alias}: cannot use ${JSON.stringify(value)} as ${type}`,
      {
        category: "validation",
        hint: `${type} values in a condition are written in ${isoExample(type)}; the library converts them to PORTERS' format.`,
        // The underlying RangeError stays on `cause` rather than in the message: the message
        // already names the field, the value and the type, which is what a reader needs.
        context: { operation: "read" },
        cause,
      },
    );
  }
};

/**
 * Serialise one condition value by the field's Data Type: dates ISO -> PORTERS, arrays (Option
 * aliases / id sets) colon-joined, everything else stringified. No Data Type — an unknown alias
 * (`undefined`) or a field PORTERS types none (`null` — ADR-0056) -> raw scalar, mirroring
 * read/write passthrough. Reaching the `null` case needs a cast: `ConditionFor<null>` is `never`.
 */
const serializeConditionValue = (
  type: DataType | null | undefined,
  value: unknown,
  alias: string,
): string => {
  if (Array.isArray(value)) return value.map(String).join(":");
  if (type === "DateTime" || type === "System[DateTime]") {
    return convertedForQuery(alias, type, value, () =>
      isoToPortersDateTime(String(value)),
    );
  }
  if (type === "Date" || type === "Age") {
    return convertedForQuery(alias, type, value, () =>
      isoToPortersDate(String(value)),
    );
  }
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
        `${qualify(ctx.prefix, alias)}:${suffix}=${serializeConditionValue(type, value, alias)}`,
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
      parts.push(`${qualify(ctx.prefix, alias)}:${dir}`);
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
  // An explicit itemstate is sent as given — including `existing` (ADR-0057). Only omission defers
  // to the API default, because omitting and asking for `existing` are different things to say: if
  // PORTERS ever changed that default, a caller who wrote `existing` would otherwise start receiving
  // deleted records with nothing raised. Collapsing the two would throw away what the caller told us.
  // VERIFY(live): `itemstate=existing` has never been sent to the real API. The reference lists it as
  // a value, but if it is rejected the whole call fails with Result Code 133 — see LV-15 in
  // docs/live-verification.md.
  if (q.itemstate !== undefined) p.set("itemstate", q.itemstate);
};

// --- the whole Read query -> URL parameters ---

/**
 * What a data resource's Read needs to turn a query into parameters: the `field` assembly's
 * context ({@link FieldParamContext}) plus any parameter the resource always sends.
 */
export type ReadParamsContext = FieldParamContext & {
  /**
   * Fixed query parameters this resource always sends. **Phase requires `resource=`** — the
   * upper resource whose history is being read — and it is a parameter of its own, not a
   * `condition` (ADR-0061 / Phase Read). Set once by the accessor, never by the caller.
   */
  params?: Readonly<Record<string, string>>;
};

/**
 * Serialise the Read query — `partition` / `field` / `condition` / `order` / `keywords` /
 * `itemstate` — into the parameters every page of that query shares. **Paging is deliberately not
 * here**: `count` / `start` are the only parts that differ page to page, so `readUrlOf` adds them
 * to a copy and `searchAll` can serialise the caller's query exactly once (RV-32).
 * `field` (with `expand` / `image` folded in) is {@link fieldParam}; the rest is
 * {@link appendReadQuery}. Attachment is bespoke (no prefix / no catalog) and builds its own loose
 * URL — see attachment.ts.
 */
export const buildReadParams = <F extends FieldCatalog, R extends ReferenceMap>(
  partition: number,
  q: SearchQuery<F, R>,
  ctx: ReadParamsContext,
): URLSearchParams => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  for (const [key, value] of Object.entries(ctx.params ?? {}))
    p.set(key, value);
  const field = fieldParam(ctx, q);
  if (field !== undefined) p.set("field", field);
  appendReadQuery(p, q, ctx);
  return p;
};

/**
 * Build a Read URL: `/v1/{path}?partition=…&field=…&condition=…&order=…&keywords=…&itemstate=…&count=…&start=…`
 * at the configured access point (ADR-0047) — the single-page form of {@link buildReadParams}.
 */
export const buildReadUrl = <F extends FieldCatalog, R extends ReferenceMap>(
  accessPoint: AccessPoint,
  partition: number,
  path: string,
  q: SearchQuery<F, R> & Paging,
  ctx: ReadParamsContext,
): string =>
  readUrlOf(
    accessPoint,
    path,
    buildReadParams(partition, q, ctx),
    q.count,
    q.start,
  );
