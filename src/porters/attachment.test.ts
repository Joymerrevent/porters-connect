import { describe, expect, it } from "vitest";

import {
  ATTACHMENT_REQUEST_TYPE,
  MAX_ATTACHMENT_CONTENT_CHARS,
} from "./attachment";

// 値は出典（Attachment Read / Write）のとおりに固定する。出典が変わったらここが落ちる。
describe("porters/attachment", () => {
  it("caps the Base64 content just above what a 10MB file encodes to", () => {
    const tenMegabytesInBase64 = Math.ceil((10 * 1024 * 1024) / 3) * 4;
    expect(MAX_ATTACHMENT_CONTENT_CHARS).toBe(14_000_000);
    expect(MAX_ATTACHMENT_CONTENT_CHARS).toBeGreaterThanOrEqual(
      tenMegabytesInBase64,
    );
  });

  it("switches the file body with requestType 0 (with) / 1 (without)", () => {
    expect(ATTACHMENT_REQUEST_TYPE).toEqual({
      withContent: "0",
      withoutContent: "1",
    });
  });
});
