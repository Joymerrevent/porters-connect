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
  CONDITION_SUFFIXES,
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

// 区切り文字を含む値（ADR-0105・RV-68）。PORTERS は condition の条件どうしをカンマで、一覧の値どうしを
// コロンで区切り、値の中の区切り文字を書く方法（エスケープ）を示していない。URLSearchParams は区切りの
// カンマも値の中のカンマも同じ `%2C` にするので、値の途中から別の条件として読まれる。送る前に拒否する。
const delimiterError = (
  where: string,
  value: string,
  delimiter: string,
): PortersConfigError =>
  new PortersConfigError(
    `${where}: ${JSON.stringify(value)} contains ${delimiter}, which PORTERS reads as a separator`,
    {
      category: "config",
      hint: "PORTERS offers no way to put a separator inside a value. Search on a part of the value without it, then narrow the results yourself.",
      context: { operation: "read" },
    },
  );

// One scalar condition value by the field's Data Type: dates ISO -> PORTERS, everything else stringified.
// 数の型の条件の値は、10 進の表記だけを送る。NaN / Infinity / 指数表記は、String() のまま "NaN" などとして
// 送られていた（RV-135）。id は 0 以上の整数（`ge: 0` は「すべて」を表す正しい範囲の条件）。
const assertConditionNumber = (
  alias: string,
  type: DataType | null | undefined,
  text: string,
): void => {
  const ok =
    type === "System[Id]"
      ? /^\d+$/.test(text)
      : type !== "Number" || /^-?\d+(\.\d+)?$/.test(text);
  if (ok) return;
  throw new PortersConfigError(
    `condition ${alias}: ${JSON.stringify(text)} is not ${type === "System[Id]" ? "a record id" : "a decimal number"}`,
    {
      category: "config",
      hint:
        type === "System[Id]"
          ? "Pass a record id, a whole number of 0 or more."
          : "Pass a plain decimal number (NaN, Infinity and exponent notation cannot be searched).",
      context: { operation: "read" },
    },
  );
};

// 数は 10 進の表記で書く。String() はとても小さい・大きい数を指数表記（1e-7）にし、それが拒否されていた
// （RV-150）。10 進に直すと値が変わる数（5e-324 が 0 になるなど）は、指数表記のまま残して拒否に任せる。
const conditionText = (value: unknown): string => {
  if (typeof value !== "number") return String(value);
  // -0 は "-0" ではなく "0" と書く（Math.round(-0.4) などで生まれ、id の条件で拒否されていた）。
  if (Object.is(value, -0)) return "0";
  const plain = value.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: 100,
  });
  return Number(plain) === value ? plain : String(value);
};

const serializeScalar = (
  type: DataType | null | undefined,
  value: unknown,
  alias: string,
): string => {
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
  const text = conditionText(value);
  assertConditionNumber(alias, type, text);
  return text;
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
  if (Array.isArray(value)) {
    // 空の一覧は `or=`（値なし）として送られ、PORTERS がそれをどう読むかは分からない（RV-74）。
    if (value.length === 0) {
      throw new PortersConfigError(
        `condition ${alias}: the list of values is empty`,
        {
          category: "config",
          hint: "Pass at least one value, or leave the field out of the condition.",
          context: { operation: "read" },
        },
      );
    }
    return value
      .map((v) => {
        const s = conditionText(v);
        if (s.includes(",") || s.includes(":"))
          throw delimiterError(`condition ${alias}`, s, "a comma or a colon");
        assertConditionNumber(alias, type, s);
        return s;
      })
      .join(":");
  }
  const out = serializeScalar(type, value, alias);
  // テキストと日時の値の中のコロンは拒否しない（日時の値 HH:MM:SS に含まれ、PORTERS は最初の `:` で
  // alias と suffix を区切るとみられる — ADR-0105）。
  // VERIFY(live): 値の中のコロンを PORTERS がどう読むか（日時・テキストの値のコロンがそのまま値として
  // 扱われるか）は未確認 — docs/live-verification.md (LV-35)。
  if (out.includes(","))
    throw delimiterError(`condition ${alias}`, out, "a comma");
  return out;
};

// 項目名と演算子（キー）も文字列として条件に入る。区切り文字を含むキーや知らない演算子は、値と同じく
// 別の条件として読まれうる（削除済みを読むときの項目の制限も越えられた。RV-68 の再レビュー）。
// 項目名の検査: 区切り文字と、削除済みを読むときに条件に使える項目。
const assertConditionField = (
  alias: string,
  itemstate: ItemState | undefined,
): void => {
  if (/[,:=]/.test(alias)) {
    throw delimiterError(
      "condition",
      alias,
      "a comma, a colon or an equals sign",
    );
  }
  const restricted = itemstate === "deleted" || itemstate === "all";
  if (restricted && !DELETED_CONDITION_FIELDS.has(alias)) {
    throw new PortersConfigError(
      `condition field "${alias}" is not allowed when itemstate is "${itemstate}"`,
      {
        category: "config",
        hint: "Deleted reads (itemstate deleted/all) accept only P_Id, P_UpdateDate, P_UpdatedBy in condition.",
      },
    );
  }
};

// 演算子の検査: 知らない演算子（`eq=1,P_Id:gt` のような区切り文字入りも含む）は送らない（RV-68 の再レビュー）。
const assertKnownOperator = (alias: string, suffix: string): void => {
  if (CONDITION_SUFFIXES.has(suffix)) return;
  throw new PortersConfigError(
    `condition ${alias}: unknown operator ${JSON.stringify(suffix)}`,
    {
      category: "config",
      hint: `Use one of ${[...CONDITION_SUFFIXES].join(", ")}; which ones a field takes depends on its Data Type.`,
      context: { operation: "read" },
    },
  );
};

// condition -> `Prefix.alias:suffix=value,...`. Throws if itemstate=deleted/all names a field
// outside P_Id/P_UpdateDate/P_UpdatedBy (PORTERS would 400 — fail fast before send). Typed over the
// loose catalog: `Condition<F>` is assignable in, and the encoding is purely structural.
const encodeCondition = (
  condition: Condition<FieldCatalog>,
  itemstate: ItemState | undefined,
  ctx: QueryContext,
): string => {
  const parts: string[] = [];
  for (const [alias, ops] of Object.entries(condition)) {
    if (ops === undefined) continue;
    assertConditionField(alias, itemstate);
    const type = ctx.fields.get(alias);
    for (const [suffix, value] of Object.entries(ops)) {
      if (value === undefined) continue;
      assertKnownOperator(alias, suffix);
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

// keywords -> `a,b,...`. 空のキーワード・区切りのカンマを含むキーワード・長すぎる全体を送る前に弾く。
const encodeKeywords = (keywords: readonly string[]): string => {
  for (const k of keywords) {
    // キーワードどうしもカンマで区切るので、要素の中のカンマはキーワードを 1 つ増やす（ADR-0105）。
    if (k.includes(",")) throw delimiterError("keywords", k, "a comma");
    // 空の要素は ",a," のような空のキーワードとして送られ、何に一致するか分からない（RV-97）。
    if (k.trim() === "") {
      throw new PortersConfigError(
        `keywords has an empty keyword ${JSON.stringify(k)}`,
        {
          category: "config",
          hint: "Remove the empty keyword, or leave keywords out to search without one.",
          context: { operation: "read" },
        },
      );
    }
  }
  const kw = keywords.join(",");
  // 長さは UTF-16 の単位で数える。PORTERS が文字または UTF-16 で数えるなら、短く見積もって上限を超えたまま
  // 送ることは無い（絵文字などは 2 と数えるので、長く見積もる側）。バイトで数えるなら、日本語は上限を超えたまま
  // 送られうる（その場合は PORTERS が 400 で断る）。
  // VERIFY(live): PORTERS が 100 文字を何の単位で数えるか（文字・UTF-16・バイト）は未確認 —
  // docs/live-verification.md (LV-36)。
  if (kw.length > KEYWORDS_MAX_CHARS) {
    throw new PortersConfigError(
      `keywords is ${kw.length} characters, over the ${KEYWORDS_MAX_CHARS}-character limit`,
      {
        category: "config",
        hint: "Shorten keywords: PORTERS caps the keyword search at 100 characters including commas.",
      },
    );
  }
  return kw;
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
  if (q.keywords && q.keywords.length > 0)
    p.set("keywords", encodeKeywords(q.keywords));
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
