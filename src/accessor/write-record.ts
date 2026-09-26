// The inputs a data resource's Write takes, derived from the catalog (ADR-0019 W2): which fields
// `create` requires and which a caller may write at all. Types only — the Write that sends them is
// `write-data.ts`. The counterpart of `read-record.ts` (what a Read resolves to).

import type { WritableDataType, WriteValueOf } from "../xml/encode";
import type { FieldCatalog } from "./catalog";

// Writable aliases: every field whose Data Type a user may write (excludes System[Id] /
// System[DateTime] — ADR-0016/0019).
type WritableKeys<F extends FieldCatalog> = {
  [K in keyof F]: F[K] extends WritableDataType ? K : never;
}[keyof F];

// 書き込み入力の形は ADR-0019 W2。
/**
 * Create input: the `requiredOnCreate` aliases are **required** (non-null); every
 * other writable field is optional (`null` omits). `P_Id` is supplied by the library — not here.
 */
export type CreateInput<F extends FieldCatalog, Req extends keyof F> = {
  [K in Req]: WriteValueOf<F[K]>;
} & {
  [K in Exclude<WritableKeys<F>, Req>]?: WriteValueOf<F[K]> | null;
};

/** Update input: every writable field optional (`null` omits, `""` clears). */
export type UpdateInput<F extends FieldCatalog> = {
  [K in WritableKeys<F>]?: WriteValueOf<F[K]> | null;
};
