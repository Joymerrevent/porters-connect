import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  isoExample,
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
    // $ anchor
    expect(() => portersDateTimeToIso("2026/01/02 03:04:05x")).toThrow();
    expect(() => portersDateToIso("2026/01/02x")).toThrow();
  });

  it("isoToPortersDate takes the date of a datetime in UTC", () => {
    expect(isoToPortersDate("2026-01-02T10:00:00Z")).toBe("2026/01/02");
    expect(isoToPortersDate("2026-01-02T10:00:00+00:00")).toBe("2026/01/02");
    expect(isoToPortersDate("2026-01-02T10:00:00-00:00")).toBe("2026/01/02");
  });

  // RV-86 の再レビュー。ほかのオフセットを UTC に直すと、日本時間の 0 時が黙って前日になる。受けずに弾く。
  it.each([
    "2026-09-10T00:00:00+09:00",
    "2026-09-10T23:00:00-09:00",
    "2026-09-10T00:00:00+00:30",
  ])("isoToPortersDate refuses a datetime outside UTC: %s", (value) => {
    expect(() => isoToPortersDate(value)).toThrow(
      `invalid ISO date: "${value}"`,
    );
  });

  // RV-86。前方一致だった頃は、後ろに文字が続く値や、暦に無い日付をそのまま送っていた。
  it.each([
    "2026-09-10garbage",
    "2026-02-30",
    "2026-13-01",
    "2026-02-29",
    "2026-09-10T25:00:00Z",
    "2026-09-10T00:00:00",
  ])("isoToPortersDate refuses %s", (value) => {
    expect(() => isoToPortersDate(value)).toThrow(
      `invalid ISO date: "${value}"`,
    );
  });

  it("isoToPortersDate accepts a leap day", () => {
    expect(isoToPortersDate("2024-02-29")).toBe("2024/02/29");
  });
});

// Property-based tests (fast-check). 例示テストは代表値を 1 点ずつ確かめるだけなので、
// 「どの日時でも往復して戻る」という不変条件は境界（うるう年・年跨ぎ・エポック前）で
// 崩れても気づけない。ここは値を機械に選ばせて往復性そのものを検査する。
// DateTime の入力は「時刻とゾーンがそろった ISO 8601」だけ。Date.parse に任せていたときは、
// ゾーンの無い値を実行環境の TZ で読み（TZ=Asia/Tokyo で "2026/09/10" が 2026/09/09 15:00:00 に
// なった）、存在しない日付や 24:00 を繰り上げて通していた。
describe("isoToPortersDateTime: 受け付ける形", () => {
  it("秒・小数秒は省略でき、小数秒は切り捨てる", () => {
    expect(isoToPortersDateTime("2026-09-10T12:34Z")).toBe(
      "2026/09/10 12:34:00",
    );
    expect(isoToPortersDateTime("2026-09-10T12:34:56.789Z")).toBe(
      "2026/09/10 12:34:56",
    );
  });

  it("オフセットは符号の向きどおりに UTC へ寄せ、日付もまたぐ", () => {
    expect(isoToPortersDateTime("2026-01-01T00:30:00+09:00")).toBe(
      "2025/12/31 15:30:00",
    );
    expect(isoToPortersDateTime("2026-12-31T20:00:00-05:30")).toBe(
      "2027/01/01 01:30:00",
    );
  });

  it("オフセットは ±23:59 まで", () => {
    expect(isoToPortersDateTime("2026-09-10T23:00:00+23:00")).toBe(
      "2026/09/10 00:00:00",
    );
    expect(isoToPortersDateTime("2026-09-10T00:59:00+00:59")).toBe(
      "2026/09/10 00:00:00",
    );
  });

  it("うるう日は通す", () => {
    expect(isoToPortersDateTime("2028-02-29T00:00:00Z")).toBe(
      "2028/02/29 00:00:00",
    );
  });

  it.each([
    ["ゾーンが無い", "2026-09-10T12:00:00"],
    ["日付だけ", "2026-09-10"],
    ["PORTERS の形式", "2026/09/10 12:00:00"],
    ["PORTERS の日付", "2026/09/10"],
    ["Date.parse は読む英語表記", "Sep 10 2026"],
    ["T の代わりに空白", "2026-09-10 12:00:00Z"],
    ["小文字の z", "2026-09-10T12:00:00z"],
    ["コロンの無いオフセット", "2026-09-10T12:00:00+0900"],
    ["存在しない日付", "2026-02-30T00:00:00Z"],
    ["うるう年でない 2/29", "2026-02-29T00:00:00Z"],
    ["13 月", "2026-13-01T00:00:00Z"],
    ["24 時", "2026-09-10T24:00:00Z"],
    ["60 分", "2026-09-10T12:60:00Z"],
    ["60 秒", "2026-09-10T12:00:60Z"],
    ["オフセットの時が範囲外", "2026-09-10T12:00:00+24:00"],
    ["オフセットの分が範囲外", "2026-09-10T12:00:00+09:60"],
    ["前に余分な文字", "x2026-09-10T12:00:00Z"],
    ["後ろに余分な文字", "2026-09-10T12:00:00Zx"],
    ["0 月", "2026-00-10T12:00:00Z"],
    ["0 日", "2026-09-00T12:00:00Z"],
    ["2 桁の年（Date.UTC が 1900 年代に読み替える）", "0050-09-10T12:00:00Z"],
  ])("%s（%s）は弾く", (_label, value) => {
    expect(() => isoToPortersDateTime(value)).toThrow(/invalid ISO datetime/);
  });
});

describe("isoExample", () => {
  it("DateTime はゾーンつきの例を、Date / Age は日付だけの例を返す", () => {
    expect(isoExample("DateTime")).toContain("a time and a zone");
    expect(isoExample("System[DateTime]")).toContain("a time and a zone");
    expect(isoExample("Date")).toBe(
      'ISO 8601: a date only (e.g. "2026-09-10") or a UTC datetime ending in Z',
    );
    expect(isoExample("Age")).toBe(
      'ISO 8601: a date only (e.g. "2026-09-10") or a UTC datetime ending in Z',
    );
  });
});

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
