// Internal XML layer barrel (parse + type-driven decode). Not part of the
// public surface; consumed by the resource accessors.

export { parseResourcePage } from "./parser";
export type { RawItem, ResourcePage } from "./parser";
export { decodeField } from "./decode";
export type { FieldType, FieldValue, UserRef } from "./decode";
