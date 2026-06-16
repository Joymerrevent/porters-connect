import { describe, expect, it } from "vitest";

import { base64ToBytes, bytesToBase64 } from "./base64";

describe("base64 (ADR-0018)", () => {
  it("encodes bytes to Base64 (known vector: 'Man' -> 'TWFu')", () => {
    expect(bytesToBase64(new Uint8Array([77, 97, 110]))).toBe("TWFu");
  });

  it("decodes Base64 to bytes", () => {
    expect(base64ToBytes("TWFu")).toEqual(new Uint8Array([77, 97, 110]));
  });

  it("handles empty input both ways", () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
    expect(base64ToBytes("")).toEqual(new Uint8Array([]));
  });

  it("round-trips arbitrary bytes (incl. high values and padding)", () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 128, 64, 32]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});
