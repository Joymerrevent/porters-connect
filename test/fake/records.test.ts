// Server-owned fields: what PORTERS assigns must not be dictated by the caller (write-format.md).

import { describe, expect, it } from "vitest";

import { CANDIDATE_DESCRIPTOR } from "../../src/resources/candidate";
import type { FakeResource } from "./resources";
import { createRecord, updateRecord, type RecordContext } from "./records";
import { createFakeStore } from "./store";

const CANDIDATE: FakeResource = {
  descriptor: CANDIDATE_DESCRIPTOR,
  idAlias: "P_Id",
};

const setup = () => {
  let clock = Date.parse("2026-01-02T03:04:05Z");
  const context: RecordContext = { now: () => clock, currentUserId: 9 };
  return {
    store: createFakeStore(),
    context,
    advance: (ms: number) => {
      clock += ms;
    },
  };
};

describe("createRecord", () => {
  it("assigns the id and stamps the system fields", () => {
    const { store, context } = setup();

    const record = createRecord(
      store,
      CANDIDATE,
      { P_Id: "-1", P_Owner: "5", P_Name: "山田 太郎" },
      context,
    );

    expect(record).toEqual({
      P_Id: "10001",
      P_Owner: "5",
      P_Name: "山田 太郎",
      P_RegistrationDate: "2026/01/02 03:04:05",
      P_UpdateDate: "2026/01/02 03:04:05",
      P_RegisteredBy: "9",
      P_UpdatedBy: "9",
      P_Deleted: "0", // 生存（この store に削除は無い）— ADR-0056
    });
  });

  it("ignores a caller-supplied delete flag (Write 不可 — ADR-0056)", () => {
    const { store, context } = setup();

    // 型では書けない項目なので、ここに来るのはキャスト経由だけ。それでも通さない。
    const record = createRecord(
      store,
      CANDIDATE,
      { P_Id: "-1", P_Deleted: "1" },
      context,
    );

    expect(record.P_Deleted).toBe("0");
  });

  it("ignores a caller-supplied Write-restricted timestamp", () => {
    const { store, context } = setup();

    const record = createRecord(
      store,
      CANDIDATE,
      { P_Id: "-1", P_RegistrationDate: "1999/01/01 00:00:00" },
      context,
    );

    expect(record.P_RegistrationDate).toBe("2026/01/02 03:04:05");
  });

  it("keeps a caller-supplied author but defaults the missing one", () => {
    const { store, context } = setup();

    const record = createRecord(
      store,
      CANDIDATE,
      { P_Id: "-1", P_RegisteredBy: "42" },
      context,
    );

    expect(record.P_RegisteredBy).toBe("42");
    expect(record.P_UpdatedBy).toBe("9");
  });
});

describe("updateRecord", () => {
  it("merges the sent fields and re-stamps the update trail", () => {
    const { store, context, advance } = setup();
    createRecord(
      store,
      CANDIDATE,
      { P_Id: "-1", P_Owner: "5", P_Name: "山田 太郎" },
      context,
    );

    advance(86_400_000);
    const updated = updateRecord(
      store,
      CANDIDATE,
      10001,
      { P_Id: "10001", P_Name: "山田 太郎（更新）" },
      context,
    );

    expect(updated?.P_Name).toBe("山田 太郎（更新）");
    expect(updated?.P_Owner).toBe("5"); // untouched
    expect(updated?.P_RegistrationDate).toBe("2026/01/02 03:04:05"); // create-time only
    expect(updated?.P_UpdateDate).toBe("2026/01/03 03:04:05");
  });

  it("returns undefined for an unknown id instead of creating one", () => {
    const { store, context } = setup();

    expect(
      updateRecord(store, CANDIDATE, 10001, { P_Name: "x" }, context),
    ).toBeUndefined();
    expect(store.list("candidate")).toHaveLength(0);
  });
});
