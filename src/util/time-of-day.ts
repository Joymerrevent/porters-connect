// Time-of-day (時分型) helpers — ADR-0086.
//
// PORTERS 9.3.0's time-of-day field keeps a clock time only, but on the wire it is a DateTime
// (Field Type 12) anchored to 1970/01/01: 09:00 travels as `1970/01/01 09:00:00`, and the UI's
// 24:00–47:59 range spills into the next day (26:00 → `1970/01/02 02:00:00`). Field Read reports
// it as a plain DateTime, so the library cannot tell the two apart. ADR-0086 案1e therefore keeps
// the field a `dateTime()` that reads and writes ISO like any other, and hands the caller — who
// knows which fields are clock times — these two functions to fold the anchor rule in and out.
//
// Both directions validate and throw `PortersConfigError` (`category: "validation"`) rather than
// hand over a value PORTERS would reject (Code 103 on write / Code 100 on condition, HTTP 200
// either way) or a value that was never a clock time. A guess in either direction would be the
// silent kind of wrong.

import { PortersConfigError } from "../errors";

// The ISO shape the library's own DateTime decode produces (`portersDateTimeToIso`): zero-padded,
// second precision, `Z`. Nothing else is a value that came out of a PORTERS read.
const ISO_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
// The caller's clock time: `HH:mm` or `HH:mm:ss`, zero-padded (what PORTERS' UI shows).
const CLOCK_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

// PORTERS' anchor: day 1 for 00:00–23:59, day 2 for 24:00–47:59 (the source's "基準日").
const ANCHOR_YEAR = "1970";
const ANCHOR_MONTH = "01";
const ANCHOR_DAYS: Readonly<Record<string, number>> = { "01": 0, "02": 24 };
const HOURS_PER_ANCHOR_DAY = 24;
const MAX_HOURS = 47;
const MAX_MINUTES = 59;

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Read a **time-of-day** (時分型) field's value as a clock time.
 *
 * PORTERS stores a time-of-day field as a DateTime anchored to 1970/01/01 (`24:00`–`47:59` land on
 * 1970/01/02) and Field Read cannot tell it from a date-time field (ADR-0086). Read the field as
 * usual — it decodes to ISO — and pass that ISO string here to get the clock time back:
 * `"1970-01-01T09:00:00Z"` → `"09:00"`, `"1970-01-02T02:00:00Z"` → `"26:00"`.
 *
 * Seconds are kept when they are not `00` (`"09:00:30"`) — PORTERS' UI takes hours and minutes
 * only, but the wire format carries seconds, and dropping them would lose data silently.
 *
 * @throws PortersConfigError (`category: "validation"`) when the value is not an ISO date-time on
 *   1970-01-01 / 1970-01-02 — which usually means the field is a date-time, not a time-of-day.
 * @example
 * // doccheck: fields
 * const job = await t.job.get(1);
 * const start = job?.U_startTime == null ? null : decodeTimeOfDay(job.U_startTime); // "09:00"
 */
export const decodeTimeOfDay = (iso: string): string => {
  const m = ISO_DATETIME_RE.exec(iso);
  const extra = m === null ? undefined : ANCHOR_DAYS[m[3]];
  if (
    m === null ||
    m[1] !== ANCHOR_YEAR ||
    m[2] !== ANCHOR_MONTH ||
    extra === undefined
  ) {
    throw new PortersConfigError(
      `${JSON.stringify(iso)} is not a time-of-day value (expected an ISO date-time on 1970-01-01 or 1970-01-02)`,
      {
        category: "validation",
        hint: 'A time-of-day (時分型) field reads back as "1970-01-01THH:mm:ssZ" ("1970-01-02" for 24:00-47:59). Any other date means this field is probably a date-time, not a time-of-day: keep its ISO value as is.',
      },
    );
  }
  const wireHours = Number(m[4]);
  const minutes = m[5];
  const seconds = m[6];
  // The wire hour is 00–23 within its anchor day; day 2 adds 24 to get back to the UI's 24:00–47:59.
  const hours = wireHours + extra;
  if (hours > MAX_HOURS) {
    // 1970-01-02T24:00:00Z cannot come from PORTERS (the wire hour is a clock hour); a value shaped
    // like it is not a clock time either, so it fails the same way rather than reading as 48:00.
    throw new PortersConfigError(
      `${JSON.stringify(iso)} is outside the time-of-day range (00:00-47:59)`,
      {
        category: "validation",
        hint: "PORTERS' time-of-day range is 00:00-47:59; the anchor days carry clock hours 00-23 each.",
      },
    );
  }
  // VERIFY(live): whether PORTERS ever returns non-zero seconds for a time-of-day field is
  // unconfirmed (its UI takes hours and minutes only) — docs/live-verification.md (LV-31). Seconds
  // are kept rather than dropped so a value is never silently truncated whichever way it turns out.
  return seconds === "00"
    ? `${pad2(hours)}:${minutes}`
    : `${pad2(hours)}:${minutes}:${seconds}`;
};

/**
 * Write (or search on) a **time-of-day** (時分型) field from a clock time.
 *
 * Turns `"HH:mm"` / `"HH:mm:ss"` (`00:00`–`47:59`, PORTERS' own range) into the anchored ISO
 * date-time the field takes — `"09:00"` → `"1970-01-01T09:00:00Z"`, `"26:00"` →
 * `"1970-01-02T02:00:00Z"` — so the value goes through `update` / `create` / `condition` like any
 * DateTime (ADR-0086). PORTERS answers any other date with Code 103 on write and Code 100 on
 * condition (the search is not run), so an out-of-range or malformed clock time is refused here,
 * before anything is sent.
 *
 * @throws PortersConfigError (`category: "validation"`) unless the value is `HH:mm` or `HH:mm:ss`
 *   with hours 00–47 and minutes / seconds 00–59.
 * @example
 * // doccheck: fields
 * await t.job.update(1, { U_startTime: encodeTimeOfDay("26:00") });
 * await t.job.search({ condition: { U_startTime: { ge: encodeTimeOfDay("15:00") } } });
 */
export const encodeTimeOfDay = (time: string): string => {
  const m = CLOCK_RE.exec(time);
  const hours = m === null ? NaN : Number(m[1]);
  const minutes = m === null ? NaN : Number(m[2]);
  const seconds = m === null || m[3] === undefined ? 0 : Number(m[3]);
  if (
    m === null ||
    hours > MAX_HOURS ||
    minutes > MAX_MINUTES ||
    seconds > MAX_MINUTES
  ) {
    throw new PortersConfigError(
      `time-of-day ${JSON.stringify(time)} is not "HH:mm" or "HH:mm:ss" within 00:00-47:59`,
      {
        category: "validation",
        hint: 'PORTERS stores a time-of-day (時分型) field as a DateTime anchored to 1970/01/01 (24:00-47:59 -> 1970/01/02) and rejects any other value with Code 103 (write) / Code 100 (condition). Pass the clock time as "HH:mm", e.g. "09:00" or "26:00".',
      },
    );
  }
  const day = hours >= HOURS_PER_ANCHOR_DAY ? "02" : "01";
  const wireHours = hours % HOURS_PER_ANCHOR_DAY;
  return `${ANCHOR_YEAR}-${ANCHOR_MONTH}-${day}T${pad2(wireHours)}:${pad2(minutes)}:${pad2(seconds)}Z`;
};
