// Server-owned field semantics on top of the raw store: PORTERS assigns some fields itself, and a
// value the caller sends for them must not win (write-format.md).
//
//   the primary key (`P_Id` / `Id`)         -> the store's sequence (`-1` means "create")
//   `P_RegistrationDate` / `P_UpdateDate`   -> stamped here; `System[DateTime]` is Write-restricted
//   `P_RegisteredBy` / `P_UpdatedBy`        -> auto-assigned when the caller omits them
//   `P_Deleted`                             -> `"0"` on write; only a seed may set `"1"` (ADR-0056)
//
// The library's Write types already exclude the write-restricted ones (ADR-0019), so this is the
// second line of defence: a value cast through a custom field must not slip past either. A
// resource without these system fields (Attachment) simply gets none of them stamped.
//
// **Deleted records come from outside the API.** PORTERS has no delete operation — records are
// deleted in its UI, which is exactly why the read-only `itemstate` exists. So `seedRecord` is the
// fake's stand-in for that outside world: a fixture may declare a record already deleted, while no
// request path can ever delete one. The two are different things and conflating them is what left
// `itemstate` untestable (RV-26).

import { PortersConfigError } from "../../src/errors";
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

/** The delete-state alias (`"0"` alive / `"1"` deleted). Shared with the read query's itemstate filter. */
export const DELETED = "P_Deleted";
const ALIVE = "0";
const REMOVED = "1";

/** The store table of a resource. */
export const tableOf = (resource: FakeResource): FakeTable => ({
  path: resource.descriptor.path,
  idAlias: resource.idAlias,
});

const nowPorters = (ctx: RecordContext): string =>
  isoToPortersDateTime(new Date(ctx.now()).toISOString());

// Drop what the server owns: the primary key, every `System[DateTime]` field, and the delete flag
// (reference: 「Write時の指定はできません」).
const callerFields = (
  resource: FakeResource,
  fields: FakeRecord,
): FakeRecord => {
  const out: FakeRecord = {};
  for (const [alias, value] of Object.entries(fields)) {
    if (alias === resource.idAlias) continue;
    if (alias === DELETED) continue;
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
    // 削除状態は PORTERS が持つ値（ADR-0056）。API 経由で作られるレコードは必ず生存＝"0"。
    // 削除済みにできるのは seed だけ（実機で UI から削除されるのに対応する外部経路）。
    if (has(DELETED)) record[DELETED] = ALIVE;
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

/**
 * Pre-load a record as if PORTERS already held it. Same stamping as a write, with one exception:
 * a seed **may** declare the record deleted (`P_Deleted: "1"`). That is the only way a deleted
 * record enters the fake — no request path produces one — which mirrors PORTERS, where deletion
 * happens in the UI and the API only offers `itemstate` to read the result.
 *
 * A value other than `"0"` / `"1"` is a fixture mistake, not a state to guess at: reject it here
 * rather than let a typo read as "alive" and quietly pass a test about deleted records.
 */
export const seedRecord = (
  store: FakeStore,
  resource: FakeResource,
  fields: FakeRecord,
  ctx: RecordContext,
): FakeRecord => {
  const declared = fields[DELETED];
  const record = createRecord(store, resource, fields, ctx);
  if (declared === undefined) return record;
  if (declared !== ALIVE && declared !== REMOVED) {
    throw new PortersConfigError(
      `fake server: seed ${DELETED} must be "${ALIVE}" or "${REMOVED}", got ${JSON.stringify(declared)}`,
      {
        category: "config",
        hint: `PORTERS represents the delete state as "${ALIVE}" (alive) / "${REMOVED}" (deleted).`,
      },
    );
  }
  // A resource without the field (Attachment) simply has nothing to set.
  if (DELETED in resource.descriptor.fields) record[DELETED] = declared;
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
