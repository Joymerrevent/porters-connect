// Server-owned field semantics on top of the raw store: PORTERS assigns some fields itself, and a
// value the caller sends for them must not win (write-format.md).
//
//   `P_Id`                                  -> the store's sequence (`-1` means "create")
//   `P_RegistrationDate` / `P_UpdateDate`   -> stamped here; `System[DateTime]` is Write-restricted
//   `P_RegisteredBy` / `P_UpdatedBy`        -> auto-assigned when the caller omits them
//
// The library's Write types already exclude the write-restricted ones (ADR-0019), so this is the
// second line of defence: a value cast through a custom field must not slip past either.

import type { ResourceDescriptor } from "../../src/resources/resource";
import { isoToPortersDateTime } from "../../src/util/datetime";
import type { FakeStore } from "./store";
import type { FakeRecord } from "./types";

/** What the fake needs to stamp a record: a clock and the acting user. */
export type RecordContext = { now: () => number; currentUserId: number };

// The standard aliases every resource in docs/reference uses for these system fields.
const REGISTRATION_DATE = "P_RegistrationDate";
const UPDATE_DATE = "P_UpdateDate";
const REGISTERED_BY = "P_RegisteredBy";
const UPDATED_BY = "P_UpdatedBy";

const nowPorters = (ctx: RecordContext): string =>
  isoToPortersDateTime(new Date(ctx.now()).toISOString());

// Drop what the server owns: the id and every `System[DateTime]` field.
const callerFields = (
  descriptor: ResourceDescriptor,
  fields: FakeRecord,
): FakeRecord => {
  const out: FakeRecord = {};
  for (const [alias, value] of Object.entries(fields)) {
    if (alias === "P_Id") continue;
    if (descriptor.fields[alias] === "System[DateTime]") continue;
    out[alias] = value;
  }
  return out;
};

const stamp = (
  descriptor: ResourceDescriptor,
  record: FakeRecord,
  ctx: RecordContext,
  creating: boolean,
): void => {
  const has = (alias: string): boolean => alias in descriptor.fields;
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
  descriptor: ResourceDescriptor,
  fields: FakeRecord,
  ctx: RecordContext,
): FakeRecord => {
  const record = store.create(
    descriptor.path,
    callerFields(descriptor, fields),
  );
  stamp(descriptor, record, ctx, true);
  return record;
};

/** Merge a Write `<Item>` into an existing record; `undefined` when the id is unknown. */
export const updateRecord = (
  store: FakeStore,
  descriptor: ResourceDescriptor,
  id: number,
  fields: FakeRecord,
  ctx: RecordContext,
): FakeRecord | undefined => {
  const record = store.update(
    descriptor.path,
    id,
    callerFields(descriptor, fields),
  );
  if (record === undefined) return undefined;
  stamp(descriptor, record, ctx, false);
  return record;
};
