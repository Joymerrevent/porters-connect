// Barrel: re-exports the internal XML layer (parse + type-driven decode/encode).
// Not part of the npm surface; consumed by the resource accessors.

export * from "./parse-resource-page";
export * from "./parse-write-result";
export * from "./parse-authentication";
export type * from "./field-value";
export * from "./decode-field";
export * from "./decode-reference-record";
export type * from "./write-value";
export * from "./encode-field";
export * from "./encode-write-item";
export * from "./build-write-xml";
