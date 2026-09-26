// Checking an Image value against PORTERS' limits before it is written (ADR-0064 論点3).

import { PortersConfigError } from "../errors";
import type { DataType } from "../porters/data-type";
import type { WriteItem } from "../xml/write-value";
import {
  IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_FILE_NAME_BYTES,
} from "../porters/image";

const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;

// Base64 pads to a multiple of 4 with at most two `=`, each standing in for a byte that is not
// there. Anything longer is malformed, and treating it as 2 keeps the size *over*-estimated
// rather than under (fail-safe: an oversized image is rejected, never let through).
const paddingBytes = (b64: string): number => {
  if (b64.endsWith("==")) return 2;
  if (b64.endsWith("=")) return 1;
  return 0;
};

// Decoded size straight from the Base64 length — 4 encoded characters carry 3 bytes, minus the
// padding. No need to actually decode 2MB of image just to measure it.
const base64Bytes = (b64: string): number =>
  Math.floor(b64.length / 4) * 3 - paddingBytes(b64);

const configError = (message: string, hint: string): PortersConfigError =>
  new PortersConfigError(message, { category: "config", hint });

// The write values of this item that are Image-typed and actually set. `null` / `undefined` omit
// the field, so they carry nothing to check.
const imageValues = (
  item: WriteItem,
  fields: ReadonlyMap<string, DataType | null>,
): [string, Record<string, unknown>][] =>
  Object.entries(item).flatMap(([alias, value]) =>
    fields.get(alias) === "Image" &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
      ? [[alias, value as Record<string, unknown>]]
      : [],
  );

/**
 * Check every Image value in a write item and report whether it holds one, so the caller knows to
 * send it with the request-size guard lifted. Throws {@link PortersConfigError} **before the
 * request goes out** when a value breaks one of PORTERS' three limits — 2MB decoded content, a
 * 255-byte file name, one of four MIME types — because the alternative is an opaque 400 after
 * uploading megabytes.
 */
export const guardImageWrite = (
  item: WriteItem,
  fields: ReadonlyMap<string, DataType | null>,
): boolean => {
  const values = imageValues(item, fields);
  for (const [alias, value] of values) {
    const { FileName, ContentType, Content } = value;
    if (typeof Content === "string" && base64Bytes(Content) > MAX_IMAGE_BYTES) {
      throw configError(
        `image "${alias}" is ${base64Bytes(Content)} bytes once decoded, over the 2MB limit`,
        "PORTERS accepts an image of 2MB or less. Resize or re-compress it before writing.",
      );
    }
    if (
      typeof FileName === "string" &&
      utf8Bytes(FileName) > MAX_IMAGE_FILE_NAME_BYTES
    ) {
      throw configError(
        `image "${alias}" has a ${utf8Bytes(FileName)}-byte file name, over the ${MAX_IMAGE_FILE_NAME_BYTES}-byte limit`,
        `The file name, extension included, must be ${MAX_IMAGE_FILE_NAME_BYTES} bytes or fewer — multi-byte characters count for more than one.`,
      );
    }
    if (
      typeof ContentType === "string" &&
      !(IMAGE_CONTENT_TYPES as readonly string[]).includes(ContentType)
    ) {
      throw configError(
        `image "${alias}" has content type "${ContentType}", which PORTERS does not accept`,
        `Use one of ${IMAGE_CONTENT_TYPES.join(" / ")}.`,
      );
    }
  }
  return values.length > 0;
};

/**
 * Reject a bulk write that carries an Image (ADR-0064 論点3). `createMany` / `updateMany` pack
 * records into batches sized against the ~15000-char request cap; an image is orders of magnitude
 * larger than that budget, so the packing premise does not hold. Rather than silently send a batch
 * that PORTERS will reject — or lift the cap for a 200-record request — the write is refused here
 * and the caller is pointed at single `create` / `update`, which do support images.
 */
export const guardNoImageInBulk = (
  items: readonly WriteItem[],
  fields: ReadonlyMap<string, DataType | null>,
  method: string,
): void => {
  const at = items.findIndex((item) => imageValues(item, fields).length > 0);
  if (at === -1) return;
  throw configError(
    `${method} cannot write an image (record ${at} carries one)`,
    "A bulk write is batched against the ~15000-character request cap, which an image cannot fit. Write image fields one record at a time with create() / update().",
  );
};
