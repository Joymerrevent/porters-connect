import { describe, expect, it } from "vitest";

import { rawValue } from "./raw-value";
import { createDecoder } from "./decoder";

describe("rawValue — カタログ外の値を読む（ADR-0074 D2）", () => {
  const record = createDecoder({ P_Name: "SinglelineText" } as const)({
    P_Name: "山田 太郎",
    U_memo: "面談済み",
    U_empty: "",
    U_nested: { "Option.P_Foo": "" },
  });

  it("生の文字列をそのまま返す（変換しない）", () => {
    expect(rawValue(record, "U_memo")).toBe("面談済み");
  });

  it("応答に無い alias は undefined（「空」と区別する）", () => {
    expect(rawValue(record, "U_unknown")).toBeUndefined();
  });

  it("スカラでない値（入れ子）は null", () => {
    expect(rawValue(record, "U_nested")).toBeNull();
  });

  it("空の要素は空文字のまま（レコードが持っているものを返す）", () => {
    expect(rawValue(record, "U_empty")).toBe("");
  });

  it("カタログ済みの項目も読めるが、変換後の値が string でなければ null", () => {
    expect(rawValue(record, "P_Name")).toBe("山田 太郎");
    const numeric = createDecoder({ P_Score: "Number" } as const)({
      P_Score: "80",
    });
    expect(rawValue(numeric, "P_Score")).toBeNull(); // number は string ではない
  });

  it("レコードでないものを渡しても落ちない", () => {
    expect(rawValue(undefined, "U_memo")).toBeUndefined();
    expect(rawValue(null, "U_memo")).toBeUndefined();
    expect(rawValue("scalar", "U_memo")).toBeUndefined();
    expect(rawValue([1, 2], "U_memo")).toBeUndefined();
  });
});
