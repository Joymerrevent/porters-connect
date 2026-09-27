// PORTERS' encoding of a time-of-day field on the wire (the source's "基準日" — ADR-0086 / ADR-0098).

/** The anchor date's year and month. */
export const TIME_OF_DAY_ANCHOR_YEAR = "1970";
export const TIME_OF_DAY_ANCHOR_MONTH = "01";

/** Anchor day -> hours it adds: day 1 for 00:00–23:59, day 2 for 24:00–47:59. */
export const TIME_OF_DAY_ANCHOR_DAYS: Readonly<Record<string, number>> = {
  "01": 0,
  "02": 24,
};

/** The latest hour a time-of-day value can hold (47:59). */
export const TIME_OF_DAY_MAX_HOURS = 47;
