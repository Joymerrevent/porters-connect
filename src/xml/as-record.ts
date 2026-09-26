// Narrowing helper for fast-xml-parser output. The parser is typed as `any`; we launder it through
// `unknown` and narrow here so we never spread `any`.

export const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
