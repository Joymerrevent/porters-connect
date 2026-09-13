import fc from "fast-check";
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

// Property-based tests (fast-check). 例示テストは代表値を 1 点ずつ確かめるだけなので、
// 「どの日時でも往復して戻る」という不変条件は境界（うるう年・年跨ぎ・エポック前）で
// 崩れても気づけない。ここは値を機械に選ばせて往復性そのものを検査する。
describe("datetime: 往復の不変条件（property-based）", () => {
  // PORTERS 形式は年が 4 桁固定なので、往復が定義できるのは 1000-9999 年。
  // ミリ秒も表現できないため、生成した時刻は秒に切り捨てる。
  const utcSecond = fc
    .date({
      min: new Date(Date.UTC(1000, 0, 1)),
      max: new Date(Date.UTC(9999, 11, 31, 23, 59, 59)),
      noInvalidDate: true,
    })
    .map((d) => new Date(Math.floor(d.getTime() / 1000) * 1000));

  const isoOf = (d: Date): string => d.toISOString().replace(".000Z", "Z");

  it("ISO -> PORTERS -> ISO は元に戻る", () => {
    fc.assert(
      fc.property(utcSecond, (d) => {
        const iso = isoOf(d);
        expect(portersDateTimeToIso(isoToPortersDateTime(iso))).toBe(iso);
      }),
    );
  });

  it("PORTERS -> ISO -> PORTERS は元に戻る", () => {
    fc.assert(
      fc.property(utcSecond, (d) => {
        const porters = isoToPortersDateTime(isoOf(d));
        expect(isoToPortersDateTime(portersDateTimeToIso(porters))).toBe(
          porters,
        );
      }),
    );
  });

  it("Date も往復する（タイムゾーンを持たない）", () => {
    fc.assert(
      fc.property(utcSecond, (d) => {
        const isoDate = isoOf(d).slice(0, 10);
        expect(portersDateToIso(isoToPortersDate(isoDate))).toBe(isoDate);
      }),
    );
  });

  // ライブラリの契約は「UTC に正規化する・業務タイムゾーン変換はしない」(CLAUDE.md)。
  // オフセット付き ISO は、同じ瞬間を指す限りオフセットの綴り方によらず同じ値になるはず。
  it("同じ瞬間なら、ISO のオフセット表記によらず同じ PORTERS 値になる", () => {
    fc.assert(
      fc.property(
        utcSecond,
        fc.integer({ min: -14 * 60, max: 14 * 60 }),
        (d, offsetMinutes) => {
          // ISO の壁時計 = UTC + オフセット。同じ瞬間 d を別のオフセットで綴る。
          const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
          // 壁時計が 4 桁年の外へ出る組み合わせは ISO の拡張表記（+010000-…）になり、
          // PORTERS 形式に写せる範囲の外。この不変条件の対象ではないので除外する。
          const year = shifted.getUTCFullYear();
          fc.pre(year >= 1000 && year <= 9999);

          const pad = (n: number, width = 2): string =>
            String(n).padStart(width, "0");
          const wall =
            `${pad(year, 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
            `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
          const sign = offsetMinutes < 0 ? "-" : "+";
          const abs = Math.abs(offsetMinutes);
          const offset = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;

          expect(isoToPortersDateTime(`${wall}${offset}`)).toBe(
            isoToPortersDateTime(isoOf(d)),
          );
        },
      ),
    );
  });
});
