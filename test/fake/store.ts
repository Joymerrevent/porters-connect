// The fake's behaviour core: an in-memory record store, one bucket per resource path.
// Deliberately stateful — that is what separates the fake from `createMockTransport` (a stateless
// stub, N1): `create -> read -> update` has to round-trip (ADR-0043).
//
// PORTERS has no delete API, so this store has no delete either — the constraint is honoured by
// construction rather than by a rule someone has to remember (fail-safe).
//
// Records only: what a *field* means (server-owned timestamps, User / Option expansion) is decided
// one layer up, in `records.ts` and `wire.ts`, where the Data-Type catalog is in hand.

import type { FakeRecord } from "./types";

/**
 * A table: which bucket, and which field is its primary key. The alias differs by resource —
 * `P_Id` for the data resources, `Id` for the bespoke Attachment — so it travels with the call
 * instead of being assumed.
 */
export type FakeTable = { path: string; idAlias: string };

export type FakeStore = {
  /** Every record of one resource path, in insertion order. */
  list(path: string): FakeRecord[];
  find(table: FakeTable, id: number): FakeRecord | undefined;
  /** Insert a new record, assigning the next id for that path. */
  create(table: FakeTable, fields: FakeRecord): FakeRecord;
  /** Merge into an existing record (PORTERS updates only the fields you send). */
  update(
    table: FakeTable,
    id: number,
    fields: FakeRecord,
  ): FakeRecord | undefined;
  /** Forget every record and restart the id sequences. */
  reset(): void;
};

// Ids start at 10001 — the value the reference's own Read/Write samples use.
const FIRST_ID = 10001;

export const createFakeStore = (): FakeStore => {
  const records = new Map<string, FakeRecord[]>();
  const sequences = new Map<string, number>();

  const listOf = (path: string): FakeRecord[] => {
    const existing = records.get(path);
    if (existing) return existing;
    const created: FakeRecord[] = [];
    records.set(path, created);
    return created;
  };

  const nextId = (path: string): number => {
    const id = sequences.get(path) ?? FIRST_ID;
    sequences.set(path, id + 1);
    return id;
  };

  const find = (table: FakeTable, id: number): FakeRecord | undefined =>
    listOf(table.path).find((record) => record[table.idAlias] === String(id));

  return {
    list: listOf,
    find,
    create: (table, fields) => {
      // The id is the store's to assign: a caller-sent id (`-1` on create) never survives.
      const record: FakeRecord = {
        ...fields,
        [table.idAlias]: String(nextId(table.path)),
      };
      listOf(table.path).push(record);
      return record;
    },
    update: (table, id, fields) => {
      const record = find(table, id);
      if (record === undefined) return undefined;
      Object.assign(record, fields, { [table.idAlias]: record[table.idAlias] });
      return record;
    },
    reset: () => {
      records.clear();
      sequences.clear();
    },
  };
};
