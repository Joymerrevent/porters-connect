import { describe, expect, it } from "vitest";

import {
  IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_FILE_NAME_BYTES,
} from "./image";

// 値は出典（Write API - XML Format）のとおりに固定する。出典が変わったらここが落ちる。
describe("porters/image", () => {
  it("caps the content at 2MB and the file name at 255 bytes", () => {
    expect(MAX_IMAGE_BYTES).toBe(2 * 1024 * 1024);
    expect(MAX_IMAGE_FILE_NAME_BYTES).toBe(255);
  });

  it("accepts four MIME types", () => {
    expect(IMAGE_CONTENT_TYPES).toEqual([
      "image/jpeg",
      "image/gif",
      "image/png",
      "image/bmp",
    ]);
  });
});
