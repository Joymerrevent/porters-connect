import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PortersResourceError } from "../errors/index";

import {
  decodeField,
  decodeReferenceRecord,
  type DataType,
  type DepartmentRef,
  type ImageValue,
  type UserRef,
} from "./decode";
import { parseResourcePage } from "./parser";

// `decodeField` takes the field's alias so a declared-type mismatch can name it (RV-36). These
// tests are about the decoding itself, so they pass a stand-in; the mismatch tests pass a real one.
const decode = (
  type: DataType | null,
  raw: unknown,
  alias = "P_Field",
): ReturnType<typeof decodeField> => decodeField(type, raw, alias);

const fixture = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../test/fixtures/${path}`, import.meta.url)),
    "utf8",
  );

describe("decodeField (ADR-0011)", () => {
  const page = parseResourcePage(
    fixture("candidate/read-basic.xml"),
    "Candidate",
  );
  const first = page.items[0];
  const second = page.items[1];

  it("decodes Id to a number", () => {
    expect(decode("System[Id]", first["Person.P_Id"])).toBe(10001);
  });

  it("keeps string Data Types as strings (no numeric coercion); empty -> null", () => {
    expect(decode("SinglelineText", first["Person.P_Name"])).toBe("山田 太郎");
    expect(decode("Mail", second["Person.P_Mail"])).toBeNull();
  });

  it("decodes every string Data Type as a string (empty -> null)", () => {
    const stringTypes = [
      "SinglelineText",
      "MultilineText",
      "Mail",
      "Telephone",
      "URL",
    ] as const;
    for (const t of stringTypes) {
      expect(decode(t, "hello")).toBe("hello"); // passthrough
      expect(decode(t, "")).toBeNull(); // empty -> null (guard)
      // A nested record here is a declared-type mismatch and now throws — see the
      // "declared type vs actual data" block below (RV-36).
    }
  });

  it("decodes DateTime to ISO (...Z); System[DateTime] shares the wire format", () => {
    expect(decode("DateTime", first["Person.P_UpdateDate"])).toBe(
      "2026-01-02T03:04:05Z",
    );
    // the system timestamp Data Type decodes identically (only Write differs)
    expect(decode("System[DateTime]", first["Person.P_UpdateDate"])).toBe(
      "2026-01-02T03:04:05Z",
    );
  });

  it("decodes User to a nested object", () => {
    const owner = decode("User", first["Person.P_Owner"]) as UserRef;
    expect(owner.P_Id).toBe(5);
    expect(owner.P_Type).toBe("0"); // prefixed User.P_Type resolves, not && null
    expect(owner.P_Name).toBe("採用 花子");
    expect(owner.P_Mail).toBe("hanako@example.com");
  });

  it("decodes Option to an array of selected end aliases (single + multi)", () => {
    // single selection -> a 1-element array (ADR-0017: PORTERS has no scalar form).
    // The leaf alias keeps its `Option.` prefix verbatim (no transformation).
    expect(decode("Option", first["Person.P_Phase"])).toEqual([
      "Option.P_PersonPhase_Applied",
    ]);
    // multi-select (Checkbox) -> every selected alias, in order
    expect(
      decode("Option", {
        OptionRoot: { "Option.P_Tokyo": "", "Option.P_Osaka": "" },
      }),
    ).toEqual(["Option.P_Tokyo", "Option.P_Osaka"]);
  });

  it("Option tolerates a missing OptionRoot wrapper (aliases under the field)", () => {
    // the Read API doc's sample omits OptionRoot — treat the field's children as aliases
    expect(
      decode("Option", {
        "Option.P_Tokyo": { "Option.P_Id": "87" },
      }),
    ).toEqual(["Option.P_Tokyo"]);
  });

  it("a field not present in the item -> null", () => {
    expect(decode("SinglelineText", second["Person.P_Country"])).toBeNull();
  });

  it("decodes Number and Date; empty -> null", () => {
    expect(decode("Number", "3.14")).toBe(3.14);
    expect(decode("Number", "")).toBeNull();
    expect(decode("Date", "2026/01/02")).toBe("2026-01-02");
  });

  it("decodes Age as a date (birthdate; the age is a UI-derived value)", () => {
    expect(decode("Age", "1990/01/02")).toBe("1990-01-02");
    expect(decode("Age", "")).toBeNull();
  });

  it("Option -> null for an empty OptionRoot (nothing selected)", () => {
    // A wrapper that arrived empty means "no selection", which is genuinely null. A *scalar*
    // Option is a different thing — a mismatch — and throws (RV-36).
    expect(decode("Option", { OptionRoot: "" })).toBeNull();
  });

  it("User: prefix-less keys resolve; missing User -> null", () => {
    const u = decode("User", {
      User: { P_Id: "9", P_Name: "n" },
    }) as UserRef;
    expect(u.P_Id).toBe(9);
    expect(u.P_Name).toBe("n");
    expect(decode("User", { nope: 1 })).toBeNull();
  });

  it("System[Department]: nested like User, prefixed or bare (ADR-0061)", () => {
    // PORTERS' own sample: <OwnerDepartment><Department><Department.P_Id>1001</…>
    const prefixed = decode("System[Department]", {
      Department: {
        "Department.P_Id": "1001",
        "Department.P_Name": "所属なし",
      },
    }) as DepartmentRef;
    expect(prefixed.P_Id).toBe(1001);
    expect(prefixed.P_Name).toBe("所属なし");

    const bare = decode("System[Department]", {
      Department: { P_Id: "7", P_Name: "営業部" },
    }) as DepartmentRef;
    expect(bare.P_Id).toBe(7);
    expect(bare.P_Name).toBe("営業部");

    // A record without the `Department` node is tolerated as null: the value may simply be
    // absent. A scalar is not tolerated — that is a mismatch and throws (RV-36).
    expect(decode("System[Department]", { nope: 1 })).toBeNull();
  });

  it("decodes defensively: a nested value that is present but incomplete -> null", () => {
    // These are the tolerant cases: the shape is right for the Data Type, but the piece we want
    // is not there. Guessing would be worse than null. (A *wrong* shape throws — RV-36.)
    const owner = decode("User", { User: { P_Name: "n" } }) as UserRef;
    expect(owner.P_Id).toBeNull();
    const dept = decode("System[Department]", {
      Department: { P_Name: "営業部" },
    }) as DepartmentRef;
    expect(dept.P_Id).toBeNull();
    expect(decode("Option", { OptionRoot: {} })).toBeNull();
  });

  it("decodes a System[Reference] to the referenced record's own id", () => {
    // <Job.P_Client><Client><Client.P_Id>100</Client.P_Id>...</Client></Job.P_Client>
    expect(
      decode("System[Reference]", {
        Client: { "Client.P_Id": "100", "Client.P_Name": "Acme" },
      }),
    ).toBe(100);
  });

  it("Reference: accepts a prefix-less P_Id and skips non-record siblings", () => {
    // prefix-less id (the `?? inner.P_Id` fallback)
    expect(decode("System[Reference]", { Recruiter: { P_Id: "55" } })).toBe(55);
    // an attribute / scalar sibling before the resource node is skipped, not picked
    expect(
      decode("System[Reference]", {
        "@_attr": "x",
        Client: { "Client.P_Id": "7" },
      }),
    ).toBe(7);
  });

  it("Reference: missing id / non-record nested -> null", () => {
    // Both are "the record is there but the id is not" — tolerated. A scalar `raw` is a
    // mismatch and throws instead (RV-36).
    expect(
      decode("System[Reference]", { Client: { "Client.P_Name": "Acme" } }),
    ).toBeNull(); // no P_Id
    expect(decode("System[Reference]", { Client: "oops" })).toBeNull(); // nested not a record
  });

  it("no Data Type (null) -> the raw string, unconverted (ADR-0056)", () => {
    // PORTERS がこの項目に型を与えていない＝変換の基準が無い。"0" を 0 や false にするのは
    // こちらで決めること＝発明になるので、文字列のまま返す。
    expect(decode(null, "0")).toBe("0");
    expect(decode(null, "1")).toBe("1");
    expect(decode(null, "")).toBeNull(); // 空は他の型と同じく null
    expect(decode(null, { Nested: "x" })).toBeNull(); // 非文字列は null（passthrough と同じ）
  });
});

// RV-36 / ADR-0006・ADR-0011: 「宣言型と実データの食い違いは validation で surface（フィールド名
// つき・silent な誤変換はしない）」。以前はここが黙って null になっており、利用者からは
// 「その項目は空だった」と区別が付かなかった＝気づけない壊れ方だった。
describe("宣言型と実データの食い違い（RV-36）", () => {
  it("実物が Option・宣言が文字列型なら投げる（以前は黙って null）", () => {
    expect(() =>
      decode(
        "SinglelineText",
        { OptionRoot: { "Option.P_Web": "" } },
        "U_source",
      ),
    ).toThrow(PortersResourceError);
  });

  it("実物が文字列・宣言が Option なら投げる（以前は黙って null）", () => {
    expect(() => decode("Option", "web", "U_source")).toThrow(
      PortersResourceError,
    );
  });

  it("フィールド名・category・hint を載せる（ADR-0006 の要求）", () => {
    try {
      decode("Option", "web", "U_source");
      expect.unreachable();
    } catch (e) {
      const err = e as PortersResourceError;
      expect(err).toBeInstanceOf(PortersResourceError);
      expect(err.category).toBe("validation");
      expect(err.message).toContain("U_source");
      expect(err.message).toContain("declared Option");
      expect(err.hint).toContain("Field Read");
      // 通信起因ではないので code / httpStatus は無い。
      expect(err.code).toBeNull();
      expect(err.retryable).toBe(false);
    }
  });

  it("スカラを期待する型に入れ子が来たら投げる", () => {
    for (const t of [
      "System[Id]",
      "Number",
      "DateTime",
      "Date",
      "Age",
    ] as const) {
      expect(() => decode(t, { a: 1 }, "U_x")).toThrow(PortersResourceError);
    }
  });

  it("入れ子を期待する型にスカラが来たら投げる", () => {
    for (const t of [
      "Option",
      "User",
      "System[Reference]",
      "System[Department]",
      "Image",
    ] as const) {
      expect(() => decode(t, "scalar", "U_x")).toThrow(PortersResourceError);
    }
  });

  it("形は合っているが書式が違う日時も投げる（サーバー応答が引き金）", () => {
    // 以前は素の RangeError が飛び、ページの読み取り全体が PortersError でない例外で落ちていた。
    try {
      decode("Date", "ただの文字列", "U_hiredOn");
      expect.unreachable();
    } catch (e) {
      const err = e as PortersResourceError;
      expect(err).toBeInstanceOf(PortersResourceError);
      expect(err.category).toBe("validation");
      expect(err.message).toContain("U_hiredOn");
      expect(err.hint).toContain("yyyy/mm/dd");
      expect(err.cause).toBeInstanceOf(RangeError);
    }
  });

  it("ISO をそのまま返された場合も投げる（PORTERS 形式ではない）", () => {
    expect(() => decode("Date", "2026-09-09", "U_hiredOn")).toThrow(
      PortersResourceError,
    );
    expect(() => decode("DateTime", "2026-09-09T12:00:00Z", "U_at")).toThrow(
      PortersResourceError,
    );
  });

  it("Link はどちらの形も正しいので検査しない（ADR-0064 案4a）", () => {
    // Contact の ID はスカラ、User / Department は入れ子。形で判別する型なので、
    // 形の違いは食い違いの証拠にならない。
    expect(decode("Link", "10001", "U_contact")).toBe(10001);
    expect(decode("Link", { User: { P_Id: "9" } }, "U_contact")).toEqual({
      P_Id: 9,
      P_Type: null,
      P_Name: null,
      P_Mail: null,
    });
  });

  it("空・未設定は今も null（食い違いではない）", () => {
    expect(decode("Option", "", "U_x")).toBeNull();
    expect(decode("SinglelineText", "", "U_x")).toBeNull();
    expect(decode("Image", undefined, "U_x")).toBeNull();
  });

  it("型が無い項目（ADR-0056）は検査しない — 変換の基準が無い", () => {
    expect(decode(null, { Nested: "x" }, "P_Deleted")).toBeNull();
  });
});

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

describe("decodeField: Image (ADR-0064 論点1)", () => {
  it("keeps only the sub-tags that came back (a plain read returns FileName alone)", () => {
    const value = decode("Image", {
      FileName: "photo.png",
    }) as ImageValue;
    expect(value).toEqual({ FileName: "photo.png" });
    // Absent = not requested. It must not be filled in as null, which would mean "empty".
    expect("Content" in value).toBe(false);
    expect("ContentType" in value).toBe(false);
  });

  it("decodes every selected sub-tag, empty -> null", () => {
    expect(
      decode("Image", {
        FileName: "photo.png",
        ContentType: "image/png",
        Content: "",
      }),
    ).toEqual({
      FileName: "photo.png",
      ContentType: "image/png",
      Content: null,
    });
  });

  it("tolerates prefixed sub-tags and ignores anything else in the node", () => {
    expect(
      decode("Image", {
        "Image.FileName": "photo.png",
        Unexpected: "x",
      }),
    ).toEqual({ FileName: "photo.png" });
  });

  it("throws for a non-record node — a scalar has no image in it (RV-36)", () => {
    // Used to decode to null, which was indistinguishable from "the image was empty".
    expect(() => decode("Image", "photo.png")).toThrow(PortersResourceError);
    expect(() => decode("Image", [])).toThrow(PortersResourceError);
  });
});

describe("decodeField: Link (ADR-0064 論点4)", () => {
  it("decodes a bare id (Contact) to a number", () => {
    expect(decode("Link", "10001")).toBe(10001);
  });

  it("decodes the User shape to a UserRef", () => {
    expect(
      decode("Link", {
        User: {
          "User.P_Id": "5",
          "User.P_Type": "0",
          "User.P_Name": "採用 花子",
          "User.P_Mail": "hanako@example.com",
        },
      }),
    ).toEqual({
      P_Id: 5,
      P_Type: "0",
      P_Name: "採用 花子",
      P_Mail: "hanako@example.com",
    } satisfies UserRef);
  });

  it("decodes the Department shape to a DepartmentRef", () => {
    expect(
      decode("Link", {
        Department: { "Department.P_Id": "3", "Department.P_Name": "営業部" },
      }),
    ).toEqual({ P_Id: 3, P_Name: "営業部" } satisfies DepartmentRef);
  });

  it("decodes an unrecognised shape to null rather than guessing", () => {
    expect(decode("Link", { Contact: { "Contact.P_Id": "7" } })).toBeNull();
    expect(decode("Link", [])).toBeNull();
  });
});
