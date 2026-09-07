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

import { qualify } from "../util/alias";
import type { ImageSubField, ImageValue } from "../xml/decode";
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
