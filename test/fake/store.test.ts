import { describe, expect, it } from "vitest";

import { createFakeStore } from "./store";

// Every data resource keys on `P_Id`; Attachment (`Id`) is covered in attachment.test.ts.
const candidate = { path: "candidate", idAlias: "P_Id" };
const job = { path: "job", idAlias: "P_Id" };

describe("fake store", () => {
  it("assigns ids from 10001, per resource path", () => {
    const store = createFakeStore();

    expect(store.create(candidate, { P_Name: "山田 太郎" }).P_Id).toBe("10001");
    expect(store.create(candidate, { P_Name: "佐藤 次郎" }).P_Id).toBe("10002");
    // A second resource has its own sequence, like a separate table.
    expect(store.create(job, { P_Name: "求人" }).P_Id).toBe("10001");
    expect(store.list("candidate")).toHaveLength(2);
    expect(store.list("job")).toHaveLength(1);
  });

  it("never lets the caller dictate the id", () => {
    const store = createFakeStore();
    // `-1` is what the library sends to mean "create"; it must not become the stored id.
    const created = store.create(candidate, { P_Id: "-1", P_Name: "山田" });
    expect(created.P_Id).toBe("10001");
  });

  it("finds a record by id and returns undefined for an unknown one", () => {
    const store = createFakeStore();
    store.create(candidate, { P_Name: "山田 太郎" });

    expect(store.find(candidate, 10001)?.P_Name).toBe("山田 太郎");
    expect(store.find(candidate, 99999)).toBeUndefined();
    expect(store.find(job, 10001)).toBeUndefined();
  });

  it("merges an update, leaving untouched fields and the id alone", () => {
    const store = createFakeStore();
    store.create(candidate, {
      P_Name: "山田 太郎",
      P_Mail: "taro@example.com",
      P_Phase: ["Option.P_Applied"],
    });

    const updated = store.update(candidate, 10001, {
      P_Id: "-1",
      P_Name: "山田 太郎（更新）",
    });

    expect(updated).toEqual({
      P_Id: "10001",
      P_Name: "山田 太郎（更新）",
      P_Mail: "taro@example.com",
      P_Phase: ["Option.P_Applied"],
    });
    expect(store.list("candidate")).toHaveLength(1);
  });

  it("reports a missing update target instead of creating one", () => {
    const store = createFakeStore();

    expect(store.update(candidate, 10001, { P_Name: "誰か" })).toBeUndefined();
    expect(store.list("candidate")).toHaveLength(0);
  });

  it("has no delete — PORTERS has none either", () => {
    const store = createFakeStore();
    expect(Object.keys(store)).not.toContain("delete");
  });

  it("reset() clears records and restarts the id sequences", () => {
    const store = createFakeStore();
    store.create(candidate, { P_Name: "山田 太郎" });

    store.reset();

    expect(store.list("candidate")).toHaveLength(0);
    expect(store.create(candidate, { P_Name: "再登録" }).P_Id).toBe("10001");
  });
});
