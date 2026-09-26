import { describe, expect, it } from "vitest";

import { PortersResourceError } from "../errors";
import { MAX_READ_COUNT } from "../porters/read-rules";
import { MAX_REQUEST_LENGTH } from "../porters/request";
import { packIds, readMany, recordsById } from "./read-many";

// A stand-in for the real URL: a fixed base of 10 characters plus the ids joined by a 3-character
// separator — the same shape as `…%3Aor%3D1%3A2…`, with round numbers.
const measure = (chunk: readonly number[]): number =>
  10 + chunk.map(String).join(":::").length;

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("packIds", () => {
  it("returns no chunk for no ids, without measuring anything", () => {
    let calls = 0;
    const chunks = packIds([], (chunk) => {
      calls += 1;
      return measure(chunk);
    });
    expect(chunks).toEqual([]);
    expect(calls).toBe(0);
  });

  it("keeps an id in the chunk when the URL lands exactly on the budget", () => {
    // 10 + "1" + ":::" + "2" = 15 → fits; adding ":::3" would make 19.
    expect(packIds([1, 2, 3], measure, 15)).toEqual([[1, 2], [3]]);
  });

  it("adds the same separator cost for every id after the first", () => {
    // 10 + "1" + ":::" + "2" + ":::" + "3" = 19 — a wrong base or separator shows from the third id.
    expect(packIds([1, 2, 3], measure, 19)).toEqual([[1, 2, 3]]);
    expect(packIds([1, 2, 3], measure, 18)).toEqual([[1, 2], [3]]);
  });

  it("starts a new chunk once the next id would go over the budget by one", () => {
    expect(packIds([1, 2], measure, 14)).toEqual([[1], [2]]);
  });

  it("counts each id's own width (a longer id costs more)", () => {
    // 10 + "1" + ":::" + "22" = 16
    expect(packIds([1, 22], measure, 15)).toEqual([[1], [22]]);
    expect(packIds([1, 22], measure, 16)).toEqual([[1, 22]]);
  });

  it("derives the base and the separator from the first id, whatever its width", () => {
    // 10 + "123" + ":::" + "4" = 17
    expect(packIds([123, 4], measure, 17)).toEqual([[123, 4]]);
    expect(packIds([123, 4], measure, 16)).toEqual([[123], [4]]);
  });

  it("gives an id that does not fit even alone a chunk of its own (the size guard rejects it later)", () => {
    expect(packIds([12345, 6], measure, 12)).toEqual([[12345], [6]]);
  });

  it(`holds at most ${MAX_READ_COUNT} ids per chunk`, () => {
    const chunks = packIds(range(1, 401), measure, Number.MAX_SAFE_INTEGER);
    expect(chunks.map((c) => c.length)).toEqual([200, 200, 1]);
    expect(chunks.flat()).toEqual(range(1, 401));
  });

  it("uses the request size limit when no budget is given", () => {
    const long = (chunk: readonly number[]): number =>
      MAX_REQUEST_LENGTH - 20 + chunk.map(String).join(":::").length;
    // A base of MAX - 20: "100000" (6) and ":::100001" (9) reach MAX - 5; ":::100002" would reach MAX + 4.
    expect(packIds([100000, 100001, 100002], long)).toEqual([
      [100000, 100001],
      [100002],
    ]);
  });
});

describe("recordsById", () => {
  type Rec = { P_Id?: unknown; P_Name?: string };
  const idOf = (r: Rec): unknown => r.P_Id;

  it("keys the records of a page by id", () => {
    const a = { P_Id: 1, P_Name: "a" };
    const b = { P_Id: 3, P_Name: "b" };
    const out = recordsById(
      { items: [a, b], total: 2 },
      [1, 2, 3],
      idOf,
      "Widget",
    );
    expect([...out.entries()]).toEqual([
      [1, a],
      [3, b],
    ]);
  });

  it("accepts a total equal to the number of ids asked for", () => {
    const out = recordsById(
      { items: [{ P_Id: 1 }], total: 2 },
      [1, 2],
      idOf,
      "W",
    );
    expect(out.size).toBe(1);
  });

  it("rejects a total larger than the ids asked for (the condition did not narrow the read)", () => {
    const call = () =>
      recordsById({ items: [{ P_Id: 1 }], total: 3 }, [1, 2], idOf, "Widget");
    expect(call).toThrow(PortersResourceError);
    expect(call).toThrow(
      "Widget: getMany received a total of 3 for 2 requested ids, so the id condition may not have been applied",
    );
  });

  it("rejects a record that was not asked for, naming its id", () => {
    const call = () =>
      recordsById(
        { items: [{ P_Id: 1 }, { P_Id: 9 }], total: 2 },
        [1, 2],
        idOf,
        "Widget",
      );
    expect(call).toThrow(
      "Widget: getMany received a record that was not requested (id 9), so the id condition may not have been applied",
    );
  });

  it("rejects a record without a numeric id", () => {
    expect(() =>
      recordsById({ items: [{ P_Name: "x" }], total: 1 }, [1], idOf, "W"),
    ).toThrow("a record that was not requested (id undefined)");
    expect(() =>
      recordsById({ items: [{ P_Id: "1" }], total: 1 }, [1], idOf, "W"),
    ).toThrow("a record that was not requested (id 1)");
  });

  it("carries the category, a hint and where the call was aimed", () => {
    let error: unknown;
    try {
      recordsById({ items: [{ P_Id: 9 }], total: 1 }, [1], idOf, "Widget");
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(PortersResourceError);
    const e = error as PortersResourceError;
    expect(e.category).toBe("unknown");
    expect(e.hint).toBe(
      "No records were returned. Read the records one at a time with get() instead.",
    );
    expect(e.context).toEqual({ resource: "Widget", operation: "getMany" });
  });
});

describe("readMany", () => {
  type Rec = { P_Id: number };
  // Answers each chunk with a record for every id in it except the ones in `missing`.
  const reader = (missing: readonly number[] = []) => {
    const chunks: (readonly number[])[] = [];
    return {
      chunks,
      read: (chunk: readonly number[]) => {
        chunks.push(chunk);
        const items = chunk
          .filter((id) => !missing.includes(id))
          .map((id): Rec => ({ P_Id: id }));
        return Promise.resolve({ items, total: items.length });
      },
      urlLength: measure,
      idOf: (record: Rec) => record.P_Id,
      resource: "Widget",
    };
  };

  it("answers in the order of ids, undefined where there is no record, a repeat at each position", async () => {
    const r = reader([2]);
    const out = await readMany([3, 2, 1, 3], r);
    expect(out).toEqual([{ P_Id: 3 }, undefined, { P_Id: 1 }, { P_Id: 3 }]);
    // Each id is asked for once.
    expect(r.chunks).toEqual([[3, 2, 1]]);
  });

  it("reads nothing for no ids", async () => {
    const r = reader();
    expect(await readMany([], r)).toEqual([]);
    expect(r.chunks).toEqual([]);
  });

  it("reads the chunks packIds makes, one request each", async () => {
    const r = reader();
    const ids = range(1, MAX_READ_COUNT + 1);
    const out = await readMany(ids, r);
    expect(r.chunks.map((c) => c.length)).toEqual([MAX_READ_COUNT, 1]);
    expect(out.map((x) => x?.P_Id)).toEqual(ids);
  });

  it("rejects the whole call when a chunk returns a record it did not ask for", async () => {
    await expect(
      readMany([1], {
        ...reader(),
        read: () => Promise.resolve({ items: [{ P_Id: 9 }], total: 1 }),
      }),
    ).rejects.toBeInstanceOf(PortersResourceError);
  });
});
