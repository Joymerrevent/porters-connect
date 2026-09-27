// Folding `image` into the `field` list (ADR-0064 論点2).

import { qualify } from "../util/alias";
import type { ImageSubField } from "../xml/field-value";
import type { ImageSelection } from "./image";

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

// 書き込みの側の検査（3 つの上限）は guard-image-write.ts にある（ADR-0064 論点3）。
