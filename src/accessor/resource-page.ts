// The page a Read resolves to: the standard envelope (Total / Count / Start) around the records.

import type { FieldCatalog, ReadRecord } from "./catalog";

// レコード型でパラメータ化するのは expand（ADR-0058）で行が広がるため。
/**
 * A page of decoded records: the standard Read envelope (Total / Count / Start) around whatever
 * the item decoder produced. Parametrised by the *record* rather than the catalog because a read
 * that expands references returns a wider record than the catalog alone describes.
 */
export type ResourcePageOf<T> = {
  items: T[];
  total: number;
  count: number;
  start: number;
};

export type ResourcePage<F extends FieldCatalog> = ResourcePageOf<
  ReadRecord<F>
>;
