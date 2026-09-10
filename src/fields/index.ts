// Barrel: re-exports the custom field declaration DSL (ADR-0023) and the tenant-catalog tooling
// built on it (ADR-0069). Public curation (what npm consumers see) is in src/index.ts.

export * from "./define-fields";
export * from "./generate-field-decls";
export * from "./tenant-catalog";
export * from "./verify-fields";
