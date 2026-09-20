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
  ])("refuses %s: not the library's ISO date-time shape", (value) => {
    expect(() => decodeTimeOfDay(value)).toThrow(PortersConfigError);
  });

  it("refuses a day-2 hour of 24 rather than reading it as 48:00", () => {
    // Shaped like a value but no clock hour is 24; it is outside 00:00-47:59 either way.
    const error = thrownBy(() => decodeTimeOfDay("1970-01-02T24:00:00Z"));
    expect(error.category).toBe("validation");
    expect(error.message).toContain("outside the time-of-day range");
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
});
