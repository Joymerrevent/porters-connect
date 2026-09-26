import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import { createFieldParam, fieldParam, fieldParamContext } from "./field-param";
import type { FieldCatalog } from "./catalog";

describe("accessor/field-param — createFieldParam（省略時は全項目・裸の alias に接頭辞）", () => {
  const CATALOG = {
    P_Id: "System[Id]",
    P_Owner: "User",
    P_Name: "SinglelineText",
  } as const satisfies FieldCatalog;
  const fieldOf = (field: readonly string[] | undefined): string | null => {
    const p = new URLSearchParams();
    createFieldParam("W", CATALOG)(p, field);
    return p.get("field");
  };

  it("sends every catalogued alias when field is omitted (User expanded to its 4 sub-fields)", () => {
    expect(fieldOf(undefined)).toBe(
      "W.P_Id,W.P_Owner(User.P_Id,User.P_Type,User.P_Name,User.P_Mail),W.P_Name",
    );
  });

  it("prefixes the caller's own aliases and adds nothing else", () => {
    expect(fieldOf(["P_Name"])).toBe("W.P_Name");
  });

  it("sends no field at all for []", () => {
    expect(fieldOf([])).toBeNull();
  });
});

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
