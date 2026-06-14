// Narrowing helpers for fast-xml-parser output. The parser is typed as `any`;
// we launder it through `unknown` and narrow here so we never spread `any`.

export const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;

export const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

/** Normalize a node that may be missing, single, or repeated into an array. */
export const asArray = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  return v === undefined || v === null ? [] : [v];
};
