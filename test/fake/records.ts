// Server-owned field semantics on top of the raw store: PORTERS assigns some fields itself, and a
// value the caller sends for them must not win (write-format.md).
//
//   the primary key (`P_Id` / `Id`)         -> the store's sequence (`-1` means "create")
//   `P_RegistrationDate` / `P_UpdateDate`   -> stamped here; `System[DateTime]` is Write-restricted
//   `P_RegisteredBy` / `P_UpdatedBy`        -> auto-assigned when the caller omits them
//
// The library's Write types already exclude the write-restricted ones (ADR-0019), so this is the
// second line of defence: a value cast through a custom field must not slip past either. A
// resource without these system fields (Attachment) simply gets none of them stamped.

import { isoToPortersDateTime } from "../../src/util/datetime";
import type { FakeResource } from "./resources";
import type { FakeStore, FakeTable } from "./store";
import type { FakeRecord } from "./types";

/** What the fake needs to stamp a record: a clock and the acting user. */
export type RecordContext = { now: () => number; currentUserId: number };

// The standard aliases every data resource in docs/reference uses for these system fields.
const REGISTRATION_DATE = "P_RegistrationDate";
const UPDATE_DATE = "P_UpdateDate";
const REGISTERED_BY = "P_RegisteredBy";
const UPDATED_BY = "P_UpdatedBy";

/** The store table of a resource. */
export const tableOf = (resource: FakeResource): FakeTable => ({
  path: resource.descriptor.path,
  idAlias: resource.idAlias,
});

const nowPorters = (ctx: RecordContext): string =>
  isoToPortersDateTime(new Date(ctx.now()).toISOString());

// Drop what the server owns: the primary key and every `System[DateTime]` field.
const callerFields = (
  resource: FakeResource,
  fields: FakeRecord,
): FakeRecord => {
  const out: FakeRecord = {};
  for (const [alias, value] of Object.entries(fields)) {
    if (alias === resource.idAlias) continue;
    if (resource.descriptor.fields[alias] === "System[DateTime]") continue;
    out[alias] = value;
  }
  return out;
};

const stamp = (
  resource: FakeResource,
  record: FakeRecord,
  ctx: RecordContext,
  creating: boolean,
): void => {
  const has = (alias: string): boolean => alias in resource.descriptor.fields;
  const author = String(ctx.currentUserId);
  if (creating) {
    if (has(REGISTRATION_DATE)) record[REGISTRATION_DATE] = nowPorters(ctx);
    if (has(REGISTERED_BY)) record[REGISTERED_BY] ??= author;
  }
  if (has(UPDATE_DATE)) record[UPDATE_DATE] = nowPorters(ctx);
  if (has(UPDATED_BY)) record[UPDATED_BY] = author;
};

/** Create a record from a Write `<Item>`, stamping the server-owned fields. */
export const createRecord = (
  store: FakeStore,
  resource: FakeResource,
  fields: FakeRecord,
  ctx: RecordContext,
): FakeRecord => {
  const record = store.create(
    tableOf(resource),
    callerFields(resource, fields),
  );
  stamp(resource, record, ctx, true);
  return record;
};

/** Merge a Write `<Item>` into an existing record; `undefined` when the id is unknown. */
export const updateRecord = (
  store: FakeStore,
  resource: FakeResource,
  id: number,
  fields: FakeRecord,
  ctx: RecordContext,
): FakeRecord | undefined => {
  const record = store.update(
    tableOf(resource),
    id,
    callerFields(resource, fields),
  );
  if (record === undefined) return undefined;
  stamp(resource, record, ctx, false);
  return record;
};
