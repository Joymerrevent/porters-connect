// Narrowing helper for fast-xml-parser output (see `as-record.ts`).

export const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;
