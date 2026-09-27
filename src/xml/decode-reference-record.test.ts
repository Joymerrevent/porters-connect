import { describe, expect, it } from "vitest";

import type { DataType } from "../porters/data-type";
import { decodeReferenceRecord } from "./decode-reference-record";

// 展開して読んだ System[Reference]（ADR-0058）。参照先カタログは引数で受け取る＝
// xml/ が resources/ を見ない（RV-8）ことと、入れ子タグに依存しない（LV-10）ことを両立する。
describe("decodeReferenceRecord — 展開した System[Reference]（ADR-0058）", () => {
  const CLIENT = new Map<string, DataType | null>([
    ["P_Id", "System[Id]"],
    ["P_Name", "SinglelineText"],
    ["P_UpdateDate", "System[DateTime]"],
  ]);

  it("参照先の Data Type で各項目を解く", () => {
    expect(
      decodeReferenceRecord(
        {
          Client: {
            "Client.P_Id": "500",
            "Client.P_Name": "Acme",
            "Client.P_UpdateDate": "2026/01/02 03:04:05",
          },
        },
        CLIENT,
      ),
    ).toEqual({
      P_Id: 500, // System[Id] -> number
      P_Name: "Acme", // SinglelineText -> string
      P_UpdateDate: "2026-01-02T03:04:05Z", // System[DateTime] -> ISO
    });
  });

  it("入れ子タグにも接頭辞にも依存しない（LV-10 が外れても動く）", () => {
    // 実 PORTERS のタグが `<Client>` でなくても、接頭辞が付いていなくても同じ結果になる。
    expect(
      decodeReferenceRecord({ Whatever: { P_Id: "500" } }, CLIENT),
    ).toEqual({ P_Id: 500 });
  });

  it("record でない兄弟を飛ばす", () => {
    expect(
      decodeReferenceRecord(
        { "@_attr": "x", Client: { "Client.P_Id": "7" } },
        CLIENT,
      ),
    ).toEqual({ P_Id: 7 });
  });

  it("カタログ外の alias は生の文字列で通す（上位レコードと同じ扱い）", () => {
    expect(
      decodeReferenceRecord({ Client: { "Client.U_memo": "x" } }, CLIENT),
    ).toEqual({ U_memo: "x" });
  });

  it("入れ子が record でない / raw が record でない -> null", () => {
    expect(decodeReferenceRecord({ Client: "oops" }, CLIENT)).toBeNull();
    expect(decodeReferenceRecord("scalar", CLIENT)).toBeNull();
  });
});
