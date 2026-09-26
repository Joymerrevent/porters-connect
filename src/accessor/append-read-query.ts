// Turning a typed Read query's condition / order / keywords / itemstate into wire params
// (ADR-0038), normalising dates ISO -> PORTERS and guarding the caller-side limits before send.

import { PortersConfigError } from "../errors";
import { qualify } from "../util/alias";
import {
  isoExample,
  isoToPortersDate,
  isoToPortersDateTime,
} from "../util/datetime";
import type { DataType } from "../porters/data-type";
import type { FieldCatalog } from "./catalog";
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
