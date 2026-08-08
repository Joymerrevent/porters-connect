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

export type FakeStore = {
  /** Every record of one resource path, in insertion order. */
  list(path: string): FakeRecord[];
  find(path: string, id: number): FakeRecord | undefined;
  /** Insert a new record, assigning the next id for that path. */
  create(path: string, fields: FakeRecord): FakeRecord;
  /** Merge into an existing record (PORTERS updates only the fields you send). */
  update(path: string, id: number, fields: FakeRecord): FakeRecord | undefined;
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

  const find = (path: string, id: number): FakeRecord | undefined =>
    listOf(path).find((record) => record.P_Id === String(id));

  return {
    list: listOf,
    find,
    create: (path, fields) => {
      // The id is the store's to assign: a caller-sent `P_Id` (`-1` on create) never survives.
      const record: FakeRecord = { ...fields, P_Id: String(nextId(path)) };
      listOf(path).push(record);
      return record;
    },
    update: (path, id, fields) => {
      const record = find(path, id);
      if (record === undefined) return undefined;
      Object.assign(record, fields, { P_Id: record.P_Id });
      return record;
    },
    reset: () => {
      records.clear();
      sequences.clear();
    },
  };
};
