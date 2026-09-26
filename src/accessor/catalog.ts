// A resource's field catalog and the record type derived from it: which aliases a resource has,
// what Data Type each carries, and what a decoded record looks like (ADR-0019). Every other part of
// accessor/ — query types, the decoder, the `field` parameter, the Write inputs — derives from these.

import type { DataType } from "../porters/data-type";
import type { DecodedValue } from "../xml/field-value";
import { asRecord } from "../xml/as-record";

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

// 汎用カタログ引数の既定値（ADR-0023）。`{}` は no-empty-object-type に掛かるので
// Record<never, never> で同じ空オブジェクトを表す。fields/ から import しないためここに
// 置く（RV-8: 下位モジュールが上位を参照しない）。
/** "No custom fields": the intersection-identity default for the generic catalog params. */
export type EmptyCatalog = Record<never, never>;

// optional にする「simple」型は ADR-0005 SD-3 / ADR-0019。未宣言 alias を型に出さず rawValue で
// 読ませるのは ADR-0074 D2。
/**
 * A decoded record: every known field, each `DecodedValue | null`, and **optional** because a
 * field not named in `field` is simply absent. An alias the
 * catalog does not know is not typed here — declare it with `defineFields` to get it
 * typed and converted. At runtime such a field still passes through as a raw value; read it with
 * {@link rawValue}.
 */
export type ReadRecord<F extends FieldCatalog> = {
  [K in keyof F]?: DecodedValue<F[K]> | null;
};

// 未宣言項目の逃げ道として名前付きで公開する決定は ADR-0074 D2。
/**
 * Read a field the catalog does not know — the named escape hatch for a value that
 * arrived without a declaration: through a cast in `field`, inside an expanded reference record,
 * or because PORTERS returned a field that was not asked for.
 *
 * Returns what the record actually holds, unconverted:
 *
 * - `undefined` — the alias is not on the record (it was never returned)
 * - `null` — it is there but not a scalar (PORTERS sends a nested node for Option / User / Image)
 * - `string` — the raw text, exactly as PORTERS sent it
 *
 * **No conversion happens.** A date comes back in PORTERS' own format (`2026/09/10 12:00:00`), not
 * ISO 8601, and a number comes back as text. Declare the field with `defineFields` to get the
 * converted, typed value instead — this is the escape hatch, not the normal path.
 *
 * @example
 * const page = await t.candidate.search({ field: ["P_Name"] });
 * const memo = rawValue(page.items[0], "U_memo"); // string | null | undefined
 */
export const rawValue = (
  record: unknown,
  alias: string,
): string | null | undefined => {
  const rec = asRecord(record);
  if (rec === undefined || !(alias in rec)) return undefined;
  const value = rec[alias];
  return typeof value === "string" ? value : null;
};

// 裸 alias（ADR-0059）・カタログ済みだけを受ける（ADR-0074 D1）・宣言は defineFields（ADR-0023）。
// 実行時は寛容のまま（ADR-0074）。
/**
 * What a Read `field` entry may name: a **catalogued** alias — every
 * standard `P_` field plus the custom fields declared with `defineFields`. An
 * undeclared `U_`/`A_` alias is **not** accepted: `condition`, `order` and the Write inputs have
 * always required a declaration, and `field` follows the same rule, so custom fields follow
 * one rule — declare, then use.
 *
 * Aliases are **bare**: the resource's prefix (`Person.` for Candidate) is a constant the
 * descriptor knows, so the library adds it. That makes `condition` / `order` / `field` one
 * vocabulary and turns a typo (`P_Nmae`) or a hand-written prefix into a compile error instead of
 * a request that quietly returns nothing.
 *
 * The runtime stays permissive: an alias that arrives through a cast is still sent, and
 * a response field the catalog does not know still decodes — read it with {@link rawValue}.
 */
export type ReadFieldAlias<F extends FieldCatalog> = keyof F & string;

/**
 * The catalog as a runtime lookup: alias -> Data Type (`null` = PORTERS assigns none). The catalog
 * is an `as const` object for the types; encoding, decoding and the `field` parameter look aliases
 * up by name, and every one of them builds the lookup the same way.
 */
export const fieldTypesOf = (
  fields: FieldCatalog,
): ReadonlyMap<string, DataType | null> => new Map(Object.entries(fields));
