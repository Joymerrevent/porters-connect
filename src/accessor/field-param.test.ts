import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import { fieldParam, fieldParamContext } from "./field-param";

// データ系が通る組み立て（既定 → 検査 → 接頭辞 → 展開 → 画像）。展開と画像の書式そのものは
// expand.test.ts / image.test.ts が確かめる。ここでは順番と、足し合わせたときの形を確かめる。
describe("accessor/field-param — fieldParam（既定・検査・接頭辞・展開・画像を 1 か所で）", () => {
  const ctx = fieldParamContext(
    "G",
    {
      P_Id: "System[Id]",
      P_Part: "System[Reference]",
      P_Name: "SinglelineText",
      U_photo: "Image",
    },
    {
      P_Part: {
        name: "Part",
        path: "part",
        prefix: "Pt",
        fields: { P_Id: "System[Id]" },
      },
    },
  );

  it("sends every catalogued alias when field is omitted", () => {
    expect(fieldParam(ctx, {})).toBe("G.P_Id,G.P_Part,G.P_Name,G.U_photo");
  });

  it("replaces the plain entry with the expansion and the Image sub-fields, in place", () => {
    expect(
      fieldParam(ctx, {
        field: ["P_Part", "U_photo", "P_Name"],
        expand: { P_Part: ["P_Id"] },
        image: { U_photo: ["Content"] },
      }),
    ).toBe("G.P_Part(Pt.P_Id),G.U_photo(Content),G.P_Name");
  });

  it("appends an expansion or an Image selection that field leaves out", () => {
    expect(
      fieldParam(ctx, {
        field: ["P_Name"],
        expand: { P_Part: ["P_Id"] },
        image: { U_photo: ["FileName"] },
      }),
    ).toBe("G.P_Name,G.P_Part(Pt.P_Id),G.U_photo(FileName)");
  });

  it("sends nothing for [] — not even what expand / image select", () => {
    expect(
      fieldParam(ctx, { field: [], expand: { P_Part: ["P_Id"] } }),
    ).toBeUndefined();
  });

  it("rejects an expansion hand-written into field before building anything", () => {
    expect(() => fieldParam(ctx, { field: ["G.P_Part(Pt.P_Id)"] })).toThrow(
      PortersConfigError,
    );
  });

  it("strips a prefix that came in through a cast rather than doubling it", () => {
    expect(fieldParam(ctx, { field: ["G.P_Name"] })).toBe("G.P_Name");
  });
});
