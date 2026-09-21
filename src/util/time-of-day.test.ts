import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import { decodeTimeOfDay, encodeTimeOfDay } from "./time-of-day";

// The wire rule from the source (Data Type: DateTime（時分型）の追加): 09:00 is stored as
// 1970/01/01 09:00, 26:00 as 1970/01/02 02:00. The library's DateTime decode turns those into
// ISO, which is what these helpers see.

/** The PortersConfigError `fn` throws — the test fails if it throws anything else or nothing. */
const thrownBy = (fn: () => unknown): PortersConfigError => {
  try {
    fn();
  } catch (error) {
    if (error instanceof PortersConfigError) return error;
    throw error;
  }
  throw new Error("expected a PortersConfigError");
};

describe("decodeTimeOfDay (ISO on the 1970 anchor -> clock time)", () => {
  it("reads a day-1 value as the clock time", () => {
    expect(decodeTimeOfDay("1970-01-01T09:00:00Z")).toBe("09:00");
    expect(decodeTimeOfDay("1970-01-01T00:00:00Z")).toBe("00:00");
    expect(decodeTimeOfDay("1970-01-01T23:59:00Z")).toBe("23:59");
  });

  it("adds 24 hours for a day-2 value (the UI's 24:00-47:59)", () => {
    expect(decodeTimeOfDay("1970-01-02T02:00:00Z")).toBe("26:00");
    expect(decodeTimeOfDay("1970-01-02T00:00:00Z")).toBe("24:00");
    expect(decodeTimeOfDay("1970-01-02T23:59:00Z")).toBe("47:59");
  });

  it("keeps non-zero seconds instead of dropping them (LV-31)", () => {
    expect(decodeTimeOfDay("1970-01-01T09:00:30Z")).toBe("09:00:30");
    expect(decodeTimeOfDay("1970-01-02T02:15:01Z")).toBe("26:15:01");
  });

  it.each([
    "2026-07-09T09:00:00Z", // a real date-time: the field is not a time-of-day
    "1970-01-03T00:00:00Z", // past the second anchor day
    "1970-02-01T09:00:00Z", // wrong month
    "1971-01-01T09:00:00Z", // wrong year
  ])("refuses %s: not anchored to 1970/01/01 or /02", (iso) => {
    const error = thrownBy(() => decodeTimeOfDay(iso));
    expect(error.category).toBe("validation");
    expect(error.message).toContain(JSON.stringify(iso));
    expect(error.hint).toContain("probably a date-time");
  });

  it.each([
    "1970-01-01T09:00:00", // no Z: not what the library's decode produces
    "1970-01-01T09:00:00+09:00",
    "1970-01-01T09:00Z", // no seconds
    "1970/01/01 09:00:00", // PORTERS' wire form, not ISO
    "09:00",
    "",
    // The shape is anchored at both ends: a value with anything around it is not a value.
    "x1970-01-01T09:00:00Z",
    "1970-01-01T09:00:00Zx",
    " 1970-01-01T09:00:00Z",
    "1970-01-01T09:00:00Z\n",
    "11970-01-01T09:00:00Z",
  ])("refuses %s: not the library's ISO date-time shape", (value) => {
    expect(() => decodeTimeOfDay(value)).toThrow(PortersConfigError);
  });

  // RV-55: shaped like a value, but the clock part is not a clock. Each anchor day carries hours
  // 00-23 and minutes / seconds 00-59; nothing else comes out of a PORTERS read, and reading
  // "30:00" would re-encode to a different wire value (1970-01-02T06:00:00Z).
  it.each([
    "1970-01-02T24:00:00Z", // would read as 48:00
    "1970-01-01T24:00:00Z", // 24:00 lives on day 2, never as a day-1 hour
    "1970-01-01T30:00:00Z",
    "1970-01-01T99:00:00Z",
    "1970-01-01T09:60:00Z",
    "1970-01-02T09:60:00Z",
    "1970-01-01T09:00:60Z",
    "1970-01-01T09:00:99Z",
  ])("refuses %s: the clock part is out of range", (iso) => {
    const error = thrownBy(() => decodeTimeOfDay(iso));
    expect(error.category).toBe("validation");
    expect(error.message).toContain(JSON.stringify(iso));
    expect(error.message).toContain("outside the time-of-day range");
    expect(error.hint).toContain("hours 00-23");
  });
});

describe("encodeTimeOfDay (clock time -> ISO on the 1970 anchor)", () => {
  it("anchors 00:00-23:59 to 1970-01-01", () => {
    expect(encodeTimeOfDay("09:00")).toBe("1970-01-01T09:00:00Z");
    expect(encodeTimeOfDay("00:00")).toBe("1970-01-01T00:00:00Z");
    expect(encodeTimeOfDay("23:59")).toBe("1970-01-01T23:59:00Z");
  });

  it("anchors 24:00-47:59 to 1970-01-02, minus 24 hours", () => {
    expect(encodeTimeOfDay("26:00")).toBe("1970-01-02T02:00:00Z");
    expect(encodeTimeOfDay("24:00")).toBe("1970-01-02T00:00:00Z");
    expect(encodeTimeOfDay("47:59")).toBe("1970-01-02T23:59:00Z");
  });

  it("accepts seconds and defaults them to 00", () => {
    expect(encodeTimeOfDay("09:00:30")).toBe("1970-01-01T09:00:30Z");
    expect(encodeTimeOfDay("26:15:01")).toBe("1970-01-02T02:15:01Z");
  });

  it.each([
    "48:00", // past PORTERS' range
    "09:60",
    "09:00:60",
    "9:00", // not zero-padded (PORTERS' UI shows 09:00)
    "09-00",
    "0900",
    "09:00:00:00",
    " 09:00",
    "1970-01-01T09:00:00Z", // already ISO: the caller mixed the directions up
    "",
  ])(
    "refuses %s before anything is sent (PORTERS would answer Code 103 / 100)",
    (value) => {
      const error = thrownBy(() => encodeTimeOfDay(value));
      expect(error.category).toBe("validation");
      expect(error.message).toContain(JSON.stringify(value));
      expect(error.hint).toContain("Code 103");
    },
  );
});

describe("round trip", () => {
  it("encode then decode gives the clock time back for every minute in 00:00-47:59", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 47 }),
        fc.integer({ min: 0, max: 59 }),
        (h, m) => {
          const clock = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          expect(decodeTimeOfDay(encodeTimeOfDay(clock))).toBe(clock);
        },
      ),
    );
  });

  it("keeps seconds through a round trip", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 47 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 1, max: 59 }),
        (h, m, s) => {
          const clock = [h, m, s]
            .map((n) => String(n).padStart(2, "0"))
            .join(":");
          expect(decodeTimeOfDay(encodeTimeOfDay(clock))).toBe(clock);
        },
      ),
    );
  });

  it("decode then encode gives the ISO back for every anchored value", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("01", "02"),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        (day, h, m, s) => {
          const iso = `1970-01-${day}T${[h, m, s].map((n) => String(n).padStart(2, "0")).join(":")}Z`;
          expect(encodeTimeOfDay(decodeTimeOfDay(iso))).toBe(iso);
        },
      ),
    );
  });

  // The properties above draw from the valid domain only, so they prove the round trip but not
  // the refusal (RV-55). These draw every two-digit part and pin the boundary itself: inside it the
  // trip is the identity, outside it the same input is refused rather than mapped elsewhere.
  it("decode refuses exactly the two-digit values outside hours 00-23 / minutes 00-59 / seconds 00-59", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("01", "02"),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        (day, h, m, s) => {
          const iso = `1970-01-${day}T${[h, m, s].map((n) => String(n).padStart(2, "0")).join(":")}Z`;
          if (h <= 23 && m <= 59 && s <= 59) {
            expect(encodeTimeOfDay(decodeTimeOfDay(iso))).toBe(iso);
          } else {
            expect(thrownBy(() => decodeTimeOfDay(iso)).category).toBe(
              "validation",
            );
          }
        },
      ),
    );
  });

  it("encode refuses exactly the two-digit values outside hours 00-47 / minutes 00-59 / seconds 00-59", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        fc.option(fc.integer({ min: 0, max: 99 }), { nil: undefined }),
        (h, m, s) => {
          const clock = [h, m, ...(s === undefined ? [] : [s])]
            .map((n) => String(n).padStart(2, "0"))
            .join(":");
          if (h <= 47 && m <= 59 && (s === undefined || s <= 59)) {
            expect(decodeTimeOfDay(encodeTimeOfDay(clock))).toBe(
              s === undefined || s === 0 ? clock.slice(0, 5) : clock,
            );
          } else {
            expect(thrownBy(() => encodeTimeOfDay(clock)).category).toBe(
              "validation",
            );
          }
        },
      ),
    );
  });
});
