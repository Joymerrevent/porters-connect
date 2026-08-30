// Barrel: re-exports the resources module.

// Typed Read query surface (ADR-0038 / F-2): shared, catalog-parametrised query types.
// `ReadFieldAlias` is the bare-alias `field` entry type (ADR-0059).
export type {
  Condition,
  ItemState,
  Order,
  ReadFieldAlias,
  SearchQuery,
} from "./resource";
// Reference expansion (ADR-0058): the `expand` option's types and the record it produces.
export type {
  Expand,
  ExpandedReadRecord,
  ReferenceMap,
  ReferenceTarget,
  ResourcePageOf,
} from "./resource";
// Bulk write result (ADR-0041 / F-4): shared across every data resource's createMany / updateMany.
export type { BulkWriteResult, BulkWriteResultItem } from "./resource";
export * from "./candidate";
export * from "./job";
export * from "./client";
export * from "./recruiter";
export * from "./contact";
export * from "./opportunity";
export * from "./activity";
export * from "./contract";
export * from "./process";
export * from "./resume";
export * from "./attachment";
export * from "./partition";
export * from "./user";
export * from "./field";
export * from "./option";
