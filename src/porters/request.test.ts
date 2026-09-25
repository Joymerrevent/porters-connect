import { describe, expect, it } from "vitest";

import {
  CONNECT_API_VERSION,
  MAX_REQUEST_LENGTH,
  READS_PER_MINUTE,
  WRITES_PER_MINUTE,
} from "./request";

// 値は出典（docs/usage/reference）のとおりに固定する。出典が変わったらここが落ちる。
describe("porters/request", () => {
  it("speaks Connect API Version 2", () => {
    expect(CONNECT_API_VERSION).toBe("2");
  });

  it("caps a whole request at about 15000 characters", () => {
    expect(MAX_REQUEST_LENGTH).toBe(15000);
  });

  it("allows 2000 Reads and 500 Writes per minute", () => {
    expect(READS_PER_MINUTE).toBe(2000);
    expect(WRITES_PER_MINUTE).toBe(500);
  });
});
