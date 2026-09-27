// Opt-in binary <-> Base64 helpers for Attachment / Image content (ADR-0018). The
// resource core takes a Base64 string; these let callers convert raw bytes without a
// dependency. `btoa` / `atob` are globals on Node 20+ and browsers.

import { PortersConfigError } from "../errors";

/** Encode raw bytes to a Base64 string. */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  // Build a Latin-1 "binary string" then Base64 it. O(n) string building — fine for
  // typical attachments; very large files can be encoded by the caller upstream.
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

/**
 * Decode a Base64 string back to raw bytes. Throws {@link PortersConfigError} when the text is not
 * Base64.
 */
export const base64ToBytes = (b64: string): Uint8Array => {
  let binary: string;
  try {
    binary = atob(b64);
  } catch (cause) {
    // atob は DOMException を投げる。PortersError の外の例外にしない（RV-110）。
    throw new PortersConfigError(
      "base64ToBytes: the value is not Base64 text",
      {
        category: "validation",
        hint: "Pass Base64 text, such as the content of an Attachment or an Image read back from PORTERS.",
        cause,
      },
    );
  }
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};
