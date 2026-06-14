// PORTERS datetime <-> ISO 8601 (UTC) normalization (PRD R-10 / ADR-0011).
//   DateTime `yyyy/mm/dd HH:MM:SS` (UTC) <-> ISO `...Z`
//   Date     `yyyy/mm/dd`                <-> date-only (no `Z`)
// No business-timezone (e.g. JST) conversion — that is the caller's responsibility.

const DATETIME_RE = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const DATE_RE = /^(\d{4})\/(\d{2})\/(\d{2})$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** PORTERS `yyyy/mm/dd HH:MM:SS` (UTC) -> ISO 8601 `...Z`. */
export function portersDateTimeToIso(value: string): string {
  const m = DATETIME_RE.exec(value);
  if (!m) throw new RangeError(`invalid PORTERS DateTime: "${value}"`);
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  if (Number.isNaN(Date.parse(iso))) {
    throw new RangeError(`invalid PORTERS DateTime: "${value}"`);
  }
  return iso;
}

/** ISO 8601 (with `Z` or offset) -> PORTERS `yyyy/mm/dd HH:MM:SS` (UTC). */
export function isoToPortersDateTime(value: string): string {
  const t = Date.parse(value);
  if (Number.isNaN(t)) throw new RangeError(`invalid ISO datetime: "${value}"`);
  const d = new Date(t);
  const p = (n: number): string => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}

/** PORTERS `yyyy/mm/dd` -> ISO date `yyyy-mm-dd` (no timezone). */
export function portersDateToIso(value: string): string {
  const m = DATE_RE.exec(value);
  if (!m) throw new RangeError(`invalid PORTERS Date: "${value}"`);
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** ISO date (or datetime) -> PORTERS `yyyy/mm/dd` (calendar date as-is, no shift). */
export function isoToPortersDate(value: string): string {
  const m = ISO_DATE_RE.exec(value);
  if (!m) throw new RangeError(`invalid ISO date: "${value}"`);
  return `${m[1]}/${m[2]}/${m[3]}`;
}
