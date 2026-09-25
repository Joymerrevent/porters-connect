// PORTERS' rules for an Image field (reference: Write API - XML Format — ADR-0064 / ADR-0098).

/** PORTERS' limit on an Image's decoded content: 2MB. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** PORTERS' limit on an Image's file name, extension included: 255 **bytes** (not characters). */
export const MAX_IMAGE_FILE_NAME_BYTES = 255;

// 送信前ガードと静的型で一覧を共有するのは ADR-0064 論点3。
/**
 * The MIME types PORTERS accepts for an Image field's `ContentType`. Exported so the send-time
 * guard and the static Write input agree on one list.
 */
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/gif",
  "image/png",
  "image/bmp",
] as const;

/** One of the four MIME types an Image field accepts. */
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];
