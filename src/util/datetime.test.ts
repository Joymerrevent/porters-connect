import { describe, expect, it } from "vitest";

import {
  isoToPortersDate,
  isoToPortersDateTime,
  portersDateToIso,
  portersDateTimeToIso,
} from "./datetime";

describe("datetime (PORTERS <-> ISO, UTC)", () => {
  it("DateTime -> ISO appends Z (treated as UTC, no tz shift)", () => {
    expect(portersDateTimeToIso("2026/01/02 03:04:05")).toBe(
      "2026-01-02T03:04:05Z",
    );
  });

  it("ISO -> DateTime normalizes offset to UTC", () => {
    expect(isoToPortersDateTime("2026-01-02T12:04:05+09:00")).toBe(
      "2026/01/02 03:04:05",
    );
    expect(isoToPortersDateTime("2026-01-02T03:04:05Z")).toBe(
      "2026/01/02 03:04:05",
    );
  });

  it("Date round-trips without a timezone", () => {
    expect(portersDateToIso("2026/01/02")).toBe("2026-01-02");
    expect(isoToPortersDate("2026-01-02")).toBe("2026/01/02");
  });

  it("throws on malformed input (fail-safe, no silent coercion)", () => {
    // assert the message so a blanked message / removed guard (-> TypeError) is caught
    expect(() => portersDateTimeToIso("2026-01-02 03:04:05")).toThrow(
      /invalid PORTERS DateTime/,
    );
    // regex matches but the calendar date is impossible (Date.parse -> NaN branch)
    expect(() => portersDateTimeToIso("2026/13/02 03:04:05")).toThrow(
      /invalid PORTERS DateTime/,
    );
    expect(() => portersDateToIso("not a date")).toThrow(
      /invalid PORTERS Date/,
    );
  });

  it("throws on invalid ISO input", () => {
    expect(() => isoToPortersDateTime("not-a-date")).toThrow(
      /invalid ISO datetime/,
    );
    expect(() => isoToPortersDate("garbage")).toThrow(/invalid ISO date/);
  });

  it("anchors the patterns: rejects leading/trailing garbage", () => {
    // ^ anchor
    expect(() => portersDateTimeToIso("x2026/01/02 03:04:05")).toThrow();
    expect(() => portersDateToIso("x2026/01/02")).toThrow();
    expect(() => isoToPortersDate("x2026-01-02")).toThrow();
    // $ anchor (ISO_DATE_RE intentionally has none — it takes the date prefix)
    expect(() => portersDateTimeToIso("2026/01/02 03:04:05x")).toThrow();
    expect(() => portersDateToIso("2026/01/02x")).toThrow();
  });

  it("isoToPortersDate takes the date part of a datetime", () => {
    expect(isoToPortersDate("2026-01-02T10:00:00Z")).toBe("2026/01/02");
  });
});
