// Barrel: re-exports the resources module.

// Typed Read query surface (ADR-0038 / F-2): shared, catalog-parametrised query types.
// `ReadFieldAlias` is the bare-alias `field` entry type (ADR-0059).
export type { Condition, ItemState, Order, SearchQuery } from "./core/query";
export type { ReadFieldAlias } from "./core/read";
// Reference expansion (ADR-0058): the `expand` option's types and the record it produces.
export type {
  Expand,
  ExpandedReadRecord,
  ReferenceMap,
  ReferenceTarget,
} from "./core/expand";
export type { ResourcePageOf } from "./core/read";
// Image sub-field selection (ADR-0064): the `image` option's types and the record it produces.
export type {
  ImageOption,
  ImageReadRecord,
  ImageSelectedValue,
} from "./core/image";
// Bulk write result (ADR-0041 / F-4): shared across every data resource's createMany / updateMany.
export type { BulkWriteResult, BulkWriteResultItem } from "./core/bulk-write";
// Escape hatch for a field the catalog does not know (ADR-0074 D2).
export { rawValue } from "./core/read";
export * from "./candidate";
export * from "./job";
export * from "./client";
export * from "./recruiter";
export * from "./contact";
export * from "./opportunity";
export * from "./activity";
export * from "./contract";
export * from "./sales";
export * from "./phase";
export * from "./process";
export * from "./resume";
export * from "./attachment";
export * from "./partition";
export * from "./user";
export * from "./department";
export * from "./field";
export * from "./option";
