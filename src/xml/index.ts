// Barrel: re-exports the internal XML layer (parse + type-driven decode/encode).
// Not part of the npm surface; consumed by the resource accessors.

export * from "./parser";
export * from "./decode";
export * from "./encode";
