// Image sub-field selection (ADR-0064 論点2): reading an Image field's `ContentType` / `Content`
// instead of just its `FileName`. PORTERS expresses it in `field` — `field=Resume.U_photo(FileName,Content)`
// — and the library exposes it as a typed `image` option rather than a raw string.
//
// The shape deliberately mirrors `expand` (pick sub-parts per alias; the record widens to exactly
// what was picked) while staying a **separate** entry point, because the mechanism differs: an
// expansion's sub-names come from the referenced resource's catalog, an image's are three fixed
// literals. Folding both into `Expand<R>` would make that type mean two things.
//
// This file owns the vocabulary plus the one mechanical half — the `field` entries to send. There
// is no decode half: `decodeImage` reads whichever sub-tags came back, so nothing at runtime needs
// to be told what was asked for.

import { PortersConfigError } from "../errors";
import { qualify } from "../util/alias";
import type { DataType, ImageSubField, ImageValue } from "../xml/decode";
import { IMAGE_CONTENT_TYPES, type WriteItem } from "../xml/encode";
import type { FieldCatalog } from "./read-core";

/** The aliases of `F` that are Image-typed — the only ones `image` may name. */
type ImageKeys<F extends FieldCatalog> = {
  [K in keyof F]: F[K] extends "Image" ? K : never;
}[keyof F];

/**
 * What `image` accepts: for each Image field, which of the three sub-tags to read. Naming a field
 * that is not Image-typed is a compile error, and so is an unknown sub-tag.
 *
 * ```ts
 * const page = await t.resume.search({ image: { U_photo: ["FileName", "Content"] } });
 * page.items[0]?.U_photo; // { FileName: string | null; Content: string | null }
 * ```
 *
 * Omitting a field (or selecting nothing) sends the bare alias, which PORTERS answers with
 * `FileName` alone — so a listing never drags every image body along (ADR-0064 案1a).
 */
export type ImageOption<F extends FieldCatalog> = {
  [K in ImageKeys<F>]?: readonly ImageSubField[];
};

/**
 * A caller's `image`, seen structurally — what the `field` assembly needs. The typed
 * {@link ImageOption} is what constrains callers; this is the layer underneath it.
 */
export type ImageSelection = Readonly<
  Record<string, readonly ImageSubField[] | undefined>
>;

/**
 * The value a selected Image field reads back as: exactly the sub-tags that were selected, each
 * `string | null`.
 *
 * `[S] extends [...]` is **non-distributive** for the same reason an expanded value's is — a
 * caller who types their query as the loose `SearchQuery` passes `readonly ImageSubField[] |
 * undefined`, which promises nothing, and falls through to the default {@link ImageValue}.
 */
export type ImageSelectedValue<S> = [S] extends [
  readonly (infer A extends ImageSubField)[],
]
  ? { [K in A]: string | null }
  : ImageValue;

/**
 * A read record whose selected Image fields carry exactly the sub-tags they asked for. Applied on
 * top of the (possibly expanded) record, so `image` and `expand` compose without either knowing
 * about the other. With nothing selected `keyof I` is `never`, so this is the record itself.
 *
 * Deliberately **not** written as `[keyof I] extends [never] ? Rec : …`. That short-circuit reads
 * like a cheap identity, but a conditional type in a method's return position makes
 * `ReturnType<typeof resource.search>` resolve to `any` — which would quietly switch off every
 * type-level assertion built on it (`static-types.test.ts`) instead of failing. `Omit<Rec, never>`
 * costs a little type display and keeps the assertions real.
 */
export type ImageReadRecord<Rec, I> = Omit<Rec, keyof I> & {
  [K in keyof I & keyof Rec]?: ImageSelectedValue<I[K]> | null;
};

// Only a non-empty selection changes the request: `image: { U_photo: [] }` selects nothing, which
// on the wire is the bare alias we already send (mirrors `selectedExpansions`).
const selectedImages = (
  image: ImageSelection | undefined,
): [string, readonly ImageSubField[]][] =>
  Object.entries(image ?? {}).flatMap(([alias, sub]) =>
    sub === undefined || sub.length === 0
      ? []
      : [[alias, sub] as [string, readonly ImageSubField[]]],
  );

/**
 * Fold `image` into an already-assembled `field` list: a selected alias **replaces** its plain
 * entry rather than sitting next to it — the same rule `applyExpand` follows, and for the same
 * reason (sending one alias twice has no documented winner, so we never do it).
 *
 * VERIFY(live): the `alias(FileName,ContentType,Content)` form comes from the reference's prose
 * ("既定は FileName のみ") plus the Write format's sub-element names; no sample shows the Read
 * `field` syntax for an Image. See docs/live-verification.md (LV-20) — if it is wrong, only this
 * string changes.
 */
export const applyImage = (
  entries: readonly string[],
  image: ImageSelection | undefined,
  prefix: string,
): string[] => {
  const out = [...entries];
  for (const [alias, sub] of selectedImages(image)) {
    const qualified = qualify(prefix, alias);
    const entry = `${qualified}(${sub.join(",")})`;
    const at = out.indexOf(qualified);
    if (at === -1) out.push(entry);
    else out[at] = entry;
  }
  return out;
};

// --- Write-side guards (ADR-0064 論点3) ------------------------------------------------------
//
// An image write bypasses the ~15000-char request guard (a 2MB Base64 body can never fit under
// it), so **the guard that is lifted has to be replaced**: the three limits the reference states
// are checked here, before anything is sent. This is the same trade Attachment makes (ADR-0018),
// with the checks written out because an Image has three parts rather than one.

/** PORTERS' limit on an Image's decoded content: 2MB (reference: Write API - XML Format). */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** PORTERS' limit on an Image's file name, extension included: 255 **bytes** (not characters). */
const MAX_FILE_NAME_BYTES = 255;

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
      utf8Bytes(FileName) > MAX_FILE_NAME_BYTES
    ) {
      throw configError(
        `image "${alias}" has a ${utf8Bytes(FileName)}-byte file name, over the ${MAX_FILE_NAME_BYTES}-byte limit`,
        `The file name, extension included, must be ${MAX_FILE_NAME_BYTES} bytes or fewer — multi-byte characters count for more than one.`,
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
