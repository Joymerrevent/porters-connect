// PORTERS datetime <-> ISO 8601 (UTC) normalization (PRD R-10 / ADR-0011).
//   DateTime `yyyy/mm/dd HH:MM:SS` (UTC) <-> ISO `...Z`
//   Date     `yyyy/mm/dd`                <-> date-only (no `Z`)
// No business-timezone (e.g. JST) conversion — that is the caller's responsibility.
//
// **The `RangeError`s below never reach a caller of the library** (RV-36). They say only "this text
// is not that format", which is not enough for the error contract: ADR-0006 wants the *field* named.
// So every call site catches them and re-raises a `PortersError` that knows the alias — the read
// path as `PortersResourceError` (`category: "validation"`, the response is at fault), the write and
// condition paths as `PortersConfigError` (the caller's value is). Adding the alias here instead
// would push field knowledge into a date utility, so the wrapping stays at the call sites:
// `src/xml/decode-field.ts`, `src/xml/encode-field.ts`, `src/accessor/append-read-query.ts`.

const DATETIME_RE = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const DATE_RE = /^(\d{4})\/(\d{2})\/(\d{2})$/;
// 先頭の ^ は読みやすさのため。isoToPortersDate は組み直した日付を値の全体と比べるので、無くても同じ動きになる。
// Stryker disable next-line Regex: equivalent — the calendar check compares the whole value
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// 時刻とゾーン（`Z` か `±hh:mm`）が揃った形だけを受ける。`Date.parse` に任せると、ゾーンの無い値を
// 実行環境のタイムゾーンで読み（サーバーの TZ で送る値がずれる）、`2026-02-30` を 3/2 に、`24:00` を
// 翌日に繰り上げて通してしまう。秒と小数秒は省略可（`Date#toISOString()` の出力をそのまま受けるため）。
const ISO_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

/** PORTERS `yyyy/mm/dd HH:MM:SS` (UTC) -> ISO 8601 `...Z`. */
export const portersDateTimeToIso = (value: string): string => {
  const m = DATETIME_RE.exec(value);
  if (!m) throw new RangeError(`invalid PORTERS DateTime: "${value}"`);
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  if (Number.isNaN(Date.parse(iso))) {
    throw new RangeError(`invalid PORTERS DateTime: "${value}"`);
  }
  return iso;
};

/**
 * ISO 8601 with a time and a zone (`Z` or `±hh:mm`) -> PORTERS `yyyy/mm/dd HH:MM:SS` (UTC).
 * Fractional seconds are dropped (PORTERS keeps whole seconds).
 */
export const isoToPortersDateTime = (value: string): string => {
  const m = ISO_DATETIME_RE.exec(value);
  if (!m) throw new RangeError(`invalid ISO datetime: "${value}"`);
  // 省略できる部分（秒・ゾーンのオフセット）は 0 として読む。
  const num = (part: string | undefined): number =>
    part === undefined ? 0 : Number(part);
  const [y, mo, d, h, mi, sec, oh, om] = [1, 2, 3, 4, 5, 6, 8, 9].map((i) =>
    num(m[i]),
  ) as [number, number, number, number, number, number, number, number];
  // 暦と時計の範囲は、UTC で組み直して同じ壁時計に戻るかで見る（2/30 や 24:00 は戻らない。
  // 0〜99 年は Date.UTC が 1900 年代に読み替えるので、これも戻らずに弾かれる）。
  const wall = new Date(Date.UTC(y, mo - 1, d, h, mi, sec));
  const written = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}`;
  if (wall.toISOString().slice(0, 19) !== written || oh > 23 || om > 59) {
    throw new RangeError(`invalid ISO datetime: "${value}"`);
  }
  const sign = m[7] === "-" ? -1 : 1;
  const utc = new Date(wall.getTime() - sign * (oh * 60 + om) * 60_000);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${utc.getUTCFullYear()}/${pad(utc.getUTCMonth() + 1)}/${pad(utc.getUTCDate())} ` +
    `${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}:${pad(utc.getUTCSeconds())}`
  );
};

/**
 * The accepted input form, for an error hint: DateTime needs a time and a zone, Date / Age take the
 * calendar date only.
 */
export const isoExample = (type: string): string =>
  type === "DateTime" || type === "System[DateTime]"
    ? 'ISO 8601 with a time and a zone (e.g. "2026-09-10T12:00:00Z" or "2026-09-10T21:00:00+09:00")'
    : 'ISO 8601 (e.g. "2026-09-10")';

/** PORTERS `yyyy/mm/dd` -> ISO date `yyyy-mm-dd` (no timezone). */
export const portersDateToIso = (value: string): string => {
  const m = DATE_RE.exec(value);
  if (!m) throw new RangeError(`invalid PORTERS Date: "${value}"`);
  return `${m[1]}-${m[2]}-${m[3]}`;
};

/**
 * ISO date (or datetime) -> PORTERS `yyyy/mm/dd`. A date-only value must be a real calendar date and
 * is written as-is. A datetime (ADR-0038: a Date condition takes ISO in UTC, `…Z`) must be in UTC
 * (`Z` or `±00:00`), goes through the DateTime checks and is written as its date. Another offset is
 * refused rather than shifted: `2026-09-10T00:00:00+09:00` would silently become 2026/09/09.
 * Anything else is refused: the date prefix used to be taken from `2026-09-10garbage`, and
 * `2026-02-30` went out as is (RV-86).
 */
export const isoToPortersDate = (value: string): string => {
  const m = ISO_DATE_RE.exec(value);
  if (m) {
    const date = new Date(
      Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
    );
    // 暦に無い日付（2/30・13 月）は、組み直すと別の日付になる。
    if (date.toISOString().slice(0, 10) !== value) {
      throw new RangeError(`invalid ISO date: "${value}"`);
    }
    return `${m[1]}/${m[2]}/${m[3]}`;
  }
  // 日時の形は UTC（末尾が Z か ±00:00）のものだけを受ける。ほかのオフセットを UTC に直すと、日本時間の
  // 0 時（+09:00）が黙って前日になる（RV-86 の再レビュー。decider が「Z だけ受ける」を選んだ）。
  // 末尾の $ は読みやすさのため。有効な日時で Z や ±00:00 が末尾以外に出ることはなく、続く日時の検査も末尾まで
  // 固定しているので、無くても同じ動きになる。
  // Stryker disable next-line Regex: equivalent — isoToPortersDateTime anchors the whole value
  if (!/(?:Z|[+-]00:00)$/.test(value)) {
    throw new RangeError(`invalid ISO date: "${value}"`);
  }
  try {
    return isoToPortersDateTime(value).slice(0, 10);
  } catch {
    throw new RangeError(`invalid ISO date: "${value}"`);
  }
};
