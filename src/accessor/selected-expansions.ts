// Which references a read actually expands: known references with something selected (ADR-0058).
// Shared by the `field` entries to send and the catalogs to decode the answer with.

import type { ReferenceTarget, ReferenceMap, ExpandSelection } from "./expand";

// An expansion is honoured only when the alias is a known reference *and* something was selected:
// `expand: { P_Client: [] }` selects nothing, which on the wire is the ID-only form we already send.
export const selectedExpansions = (
  expand: ExpandSelection | undefined,
  references: ReferenceMap,
): [string, ReferenceTarget, readonly string[]][] =>
  Object.entries(expand ?? {}).flatMap(([alias, sub]) => {
    const target = references[alias];
    return target === undefined || sub === undefined || sub.length === 0
      ? []
      : [[alias, target, sub] as [string, ReferenceTarget, readonly string[]]];
  });
