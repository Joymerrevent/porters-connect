import { describe, expect, it } from "vitest";

import {
  TIME_OF_DAY_ANCHOR_DAYS,
  TIME_OF_DAY_ANCHOR_MONTH,
  TIME_OF_DAY_ANCHOR_YEAR,
  TIME_OF_DAY_MAX_HOURS,
} from "./time-of-day";

// 出典（2026/7/28 Data Type: DateTime（時分型）の追加）の基準日に固定する。
describe("porters/time-of-day", () => {
  it("anchors on 1970/01/01 (00:00–23:59) and 1970/01/02 (24:00–47:59)", () => {
    expect([TIME_OF_DAY_ANCHOR_YEAR, TIME_OF_DAY_ANCHOR_MONTH]).toEqual([
      "1970",
      "01",
    ]);
    expect(TIME_OF_DAY_ANCHOR_DAYS).toEqual({ "01": 0, "02": 24 });
    expect(TIME_OF_DAY_MAX_HOURS).toBe(47);
  });
});
