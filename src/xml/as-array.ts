// Narrowing helper for fast-xml-parser output (see `as-record.ts`).

/** Normalize a node that may be missing, single, or repeated into an array. */
export const asArray = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  return v === undefined || v === null ? [] : [v];
};
