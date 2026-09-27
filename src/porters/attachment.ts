// PORTERS' rules for Attachment (ADR-0098).

/**
 * PORTERS takes files up to 10MB. A 10MB file is ~13.98M Base64 chars, so the encoded `Content` is
 * capped at 14,000,000 characters before send (the ~15000-char request guard is bypassed for uploads).
 */
// 上限の出典は Attachment - Write の注意点（10MB を超えるファイルはサポートされない）。
// VERIFY(live): 10MB が何の単位か（10,000,000 バイトか 10 MiB か、デコード後のバイト数か）は出典に無い —
// docs/live-verification.md (LV-38)。値は ADR-0018 のまま（RV-111）。
export const MAX_ATTACHMENT_CONTENT_CHARS = 14_000_000;

/**
 * `requestType` — Attachment Read's own switch for whether the file body comes back
 * (source: `0` 添付ファイル本体を含む / `1` 含まない).
 */
export const ATTACHMENT_REQUEST_TYPE = {
  withContent: "0",
  withoutContent: "1",
} as const;
