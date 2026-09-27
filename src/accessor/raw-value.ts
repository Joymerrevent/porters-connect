// The named escape hatch for a field the catalog does not know (ADR-0074 D2): read what the
// record holds, unconverted.

import { asRecord } from "../xml/as-record";

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
