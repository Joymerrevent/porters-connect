// Opt-in binary <-> Base64 helpers for Attachment / Image content (ADR-0018). The
// resource core takes a Base64 string; these let callers convert raw bytes without a
// dependency. `btoa` / `atob` are globals on Node 20+ and browsers.

/** Encode raw bytes to a Base64 string. */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  // Build a Latin-1 "binary string" then Base64 it. O(n) string building — fine for
  // typical attachments; very large files can be encoded by the caller upstream.
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

/** Decode a Base64 string back to raw bytes. */
export const base64ToBytes = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
