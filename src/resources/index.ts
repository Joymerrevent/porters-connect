// Barrel: re-exports the resources module.

// Typed Read query surface (ADR-0038 / F-2): shared, catalog-parametrised query types.
export type { Condition, ItemState, Order, SearchQuery } from "./resource";
// Bulk write result (ADR-0041 / F-4): shared across every data resource's createMany / updateMany.
export type { BulkWriteResult, BulkWriteResultItem } from "./resource";
export * from "./candidate";
export * from "./job";
export * from "./client";
export * from "./process";
export * from "./resume";
export * from "./attachment";
export * from "./partition";
export * from "./user";
export * from "./field";
export * from "./option";
