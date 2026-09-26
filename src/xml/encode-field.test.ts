import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { PortersConfigError, PortersError } from "../errors/index";

import type { DataType } from "../porters/data-type";
import { buildWriteXml } from "./build-write-xml";
import { encodeField } from "./encode-field";

const FIELDS = new Map<string, DataType>([
  ["P_Id", "System[Id]"],
  ["P_Owner", "User"],
  ["P_Name", "SinglelineText"],
  ["P_Reading", "SinglelineText"],
  ["P_PhaseDate", "DateTime"],
  ["P_Phase", "Option"],
]);
// `encodeField` takes the field's alias so an unconvertible value can name it (RV-36). These
// tests are about the encoding, so they pass a stand-in; the failure tests pass a real one.
const enc = (
  type: Parameters<typeof encodeField>[0],
  value: Parameters<typeof encodeField>[1],
  alias = "P_Field",
): string => encodeField(type, value, alias);

describe("encodeField (ADR-0011, Write)", () => {
  it("keeps string Data Types as-is but escapes & < >", () => {
    const stringTypes = [
      "SinglelineText",
      "MultilineText",
      "Mail",
      "Telephone",
      "URL",
    ] as const;
    for (const t of stringTypes) {
      expect(enc(t, "a&b<c>d")).toBe("a&amp;b&lt;c&gt;d");
    }
    expect(enc("MultilineText", "山田 太郎")).toBe("山田 太郎");
  });

  it("serializes System[Id] / Number / User / System[Reference] (ID-only) as a plain scalar", () => {
    expect(enc("System[Id]", -1)).toBe("-1");
    expect(enc("Number", 42)).toBe("42");
    expect(enc("User", 5)).toBe("5"); // Write is the ID, not a nested ref
    expect(enc("System[Reference]", 100)).toBe("100"); // System[Reference] -> id only
  });

  it("converts DateTime / Date from ISO to PORTERS (UTC)", () => {
    expect(enc("DateTime", "2020-01-02T03:04:05Z")).toBe("2020/01/02 03:04:05");
    // System[DateTime] serializes identically (Write is rejected at the input type, not here)
    expect(enc("System[DateTime]", "2020-01-02T03:04:05Z")).toBe(
      "2020/01/02 03:04:05",
    );
    expect(enc("Date", "2020-01-02")).toBe("2020/01/02");
    expect(enc("Age", "1990-01-02")).toBe("1990/01/02"); // Age shares Date's wire format
  });

  it("writes Option from an array of aliases (canonical); a lone string is tolerated", () => {
    // canonical input: an array of selected aliases (ADR-0017, symmetric with read)
    expect(enc("Option", ["Option.P_Tokyo", "Option.P_Kanagawa"])).toBe(
      "<Option.P_Tokyo/><Option.P_Kanagawa/>",
    );
    // fail-safe: a lone string is wrapped as a 1-element selection
    expect(enc("Option", "Option.P_Tokyo")).toBe("<Option.P_Tokyo/>");
  });
});

describe("encodeField: Image / Link (ADR-0064)", () => {
  it("writes an Image as the three nested sub-elements, in PORTERS' order", () => {
    expect(
      enc("Image", {
        Content: "QUJD",
        FileName: "photo.png",
        ContentType: "image/png",
      }),
    ).toBe(
      "<FileName>photo.png</FileName>" +
        "<ContentType>image/png</ContentType>" +
        "<Content>QUJD</Content>",
    );
  });

  it("escapes an image sub-value and omits a key that is not there (cast-only)", () => {
    expect(
      enc("Image", {
        FileName: "a&b<c>.png",
      } as unknown as Parameters<typeof encodeField>[1]),
    ).toBe("<FileName>a&amp;b&lt;c&gt;.png</FileName>");
  });

  it("falls back to a scalar when an Image value is not an object (cast-only)", () => {
    expect(enc("Image", "photo.png")).toBe("photo.png");
    expect(enc("Image", ["a"])).toBe("a");
  });

  it("serializes an object handed to a non-Image type visibly (cast-only)", () => {
    expect(
      enc("SinglelineText", {
        FileName: "photo.png",
      } as unknown as Parameters<typeof encodeField>[1]),
    ).toBe('{"FileName":"photo.png"}');
  });

  it("writes a Link as the referenced id only", () => {
    expect(enc("Link", 10001)).toBe("10001");
  });

  it("nests an Image inside its own field element on a write", () => {
    const xml = buildWriteXml({
      resource: "Resume",
      prefix: "Resume",
      fields: new Map<string, DataType>([["U_photo", "Image"]]),
      items: [
        {
          U_photo: {
            FileName: "photo.png",
            ContentType: "image/png",
            Content: "QUJD",
          },
        },
      ],
    });
    expect(xml).toBe(
      "<Resume><Item><Resume.U_photo>" +
        "<FileName>photo.png</FileName>" +
        "<ContentType>image/png</ContentType>" +
        "<Content>QUJD</Content>" +
        "</Resume.U_photo></Item></Resume>",
    );
  });
});

// RV-36: 日時だけは変換するので、変換できない値は送れない。以前はここで素の RangeError が飛び、
// PortersError の系統から外れていた＝ガイドが勧める `instanceof PortersError` の分岐で漏れた。
describe("変換できない値（RV-36）", () => {
  it("ISO でない日付は PortersConfigError（category: validation）", () => {
    try {
      enc("Date", "not-a-date", "U_hiredOn");
      expect.unreachable();
    } catch (e) {
      const err = e as PortersConfigError;
      expect(err).toBeInstanceOf(PortersConfigError);
      expect(err).toBeInstanceOf(PortersError);
      expect(err.category).toBe("validation");
      expect(err.message).toContain("U_hiredOn");
      expect(err.hint).toContain("ISO 8601");
      // 失敗した工程（ADR-0006）。
      expect(err.context).toEqual({ operation: "encode" });
      // 原因の RangeError は cause に残す（握り潰さない）。
      expect(err.cause).toBeInstanceOf(RangeError);
    }
  });

  it("PORTERS 形式をそのまま渡した典型的な取り違えも弾く", () => {
    // ライブラリの入力は ISO 8601（PRD R-10）。素通しにすると "2026/09/09" は通るが
    // ISO の側が変換されずに出ていくので、弾く側で揃えている。
    expect(() => enc("Date", "2026/09/09")).toThrow(PortersConfigError);
  });

  it("DateTime はゾーンの無い値・日付だけの値を弾き、hint でゾーンが要ると伝える", () => {
    expect(() => enc("DateTime", "2026/09/10")).toThrow(PortersConfigError);
    expect(() => enc("DateTime", "2026-09-10")).toThrow(PortersConfigError);
    try {
      enc("DateTime", "2026-09-10T12:00:00", "P_PhaseDate");
      expect.unreachable();
    } catch (e) {
      expect((e as PortersConfigError).hint).toContain("a time and a zone");
    }
  });

  it("DateTime / Age も同じ経路", () => {
    expect(() => enc("DateTime", "nope")).toThrow(PortersConfigError);
    expect(() => enc("Age", "nope")).toThrow(PortersConfigError);
  });

  it("変換を持たない型は素通し＝検査しない（意図した非対称・#4 = 案3）", () => {
    // サーバーが弾くものを手前で弾いても防げるのは silent な失敗ではないので足していない。
    expect(enc("Number", "abc")).toBe("abc");
    expect(enc("Mail", "not-a-mail")).toBe("not-a-mail");
    expect(enc("Telephone", "---")).toBe("---");
    expect(enc("URL", "nope")).toBe("nope");
  });
});

// ADR-0085。PCDATA 側（上の「書いて読むと戻る」）と対になる、**名前の位置**の試験。
// RV-48 はここに例が 1 件も無かったので、カバレッジ 100% のまま穴が残っていた。
describe("要素名になる値の検証（ADR-0085 / RV-48）", () => {
  // RV-48 の実測で使った払い出し。`<Item>` を閉じて開き直し、別レコードを名指す。
  const INJECTION =
    "Option.P_Applied/></Person.P_Phase><Person.P_Id>999</Person.P_Id></Item>" +
    "<Item><Person.P_Name>pwned</Person.P_Name><Person.P_Phase><Option.P_Applied";

  const write = (items: Record<string, unknown>[]): string =>
    buildWriteXml({
      resource: "Candidate",
      prefix: "Person",
      fields: FIELDS,
      items: items as Parameters<typeof buildWriteXml>[0]["items"],
    });

  it("RV-48 の払い出しを Option の alias から弾く", () => {
    expect(() => write([{ P_Id: 10001, P_Phase: [INJECTION] }])).toThrow(
      PortersConfigError,
    );
  });

  it("弾くときは validation の PortersConfigError（ADR-0006）で、項目と値を名指す", () => {
    try {
      write([{ P_Phase: ["a<b"] }]);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PortersConfigError);
      const err = e as PortersConfigError;
      expect(err.category).toBe("validation");
      // どの項目の、どの値が悪いのかが分からないと直せない。
      expect(err.message).toContain("P_Phase");
      expect(err.message).toContain("a<b");
      // **どちらの境界で落ちたか**も要る。選択肢 alias と項目 alias は直し方が違う
      // （前者は値を、後者は入力オブジェクトのキーを疑う）。
      expect(err.message).toContain("option alias");
      // hint は「何が正しい形か」と「正しい値をどこから得るか」を言う。全文ではなく
      // その 2 つが残っているかだけを見る（文言の言い換えで落ちないように）。
      expect(err.hint).toContain("XML Name");
      expect(err.hint).toContain("t.option");
      // 失敗した工程。エラーを分類して扱う利用者はここを見る（ADR-0006）。
      expect(err.context?.operation).toBe("encode");
    }
  });

  it.each([
    ["空白を含む", "Option.P_A B"],
    ["数字始まり", "1Option"],
    ["空文字", ""],
    ["`>` を含む", "a>b"],
    ["`/` を含む", "a/b"],
    ["`&` を含む", "a&b"],
  ])("Option の alias が %s とき弾く（%j）", (_label, alias) => {
    expect(() => write([{ P_Phase: [alias] }])).toThrow(PortersConfigError);
  });

  it("正規の alias は通す（日本語の選択肢を含む）", () => {
    const xml = write([{ P_Phase: ["Option.P_Applied", "Option.P_東京"] }]);
    expect(xml).toContain(
      "<Person.P_Phase><Option.P_Applied/><Option.P_東京/></Person.P_Phase>",
    );
  });

  it("項目 alias（item のキー）も同じ検証を通る — 論点2 (ii)", () => {
    // 型は `WritableKeys<F>` に絞っているが、excess property check はフレッシュな
    // リテラルにしか効かない。`JSON.parse(...) as …` ならこのキーが実行時に届く。
    const untrusted = JSON.parse(
      '{"P_Name></Person.P_Name><Person.P_Id>999</Person.P_Id><Person.P_Name":"x"}',
    ) as Record<string, unknown>;
    expect(() => write([untrusted])).toThrow(PortersConfigError);
    // 選択肢 alias 側と取り違えないこと（直すのは入力オブジェクトのキーのほう）。
    expect(() => write([untrusted])).toThrow(/field alias/);
  });

  it("同じ文字列でも、本文の位置なら従来どおり通る（過剰に締めていない）", () => {
    // エスケープが効く経路は塞がない。ここが締まると round-trip が壊れる。
    const xml = write([{ P_Name: INJECTION }]);
    expect(xml).toContain("&lt;/Person.P_Phase&gt;");
    expect(xml).not.toContain("<Person.P_Id>999</Person.P_Id>");
  });

  it("どんな alias を渡しても <Item> は増やせない（property-based）", () => {
    const count = (xml: string, needle: string): number =>
      xml.split(needle).length - 1;
    fc.assert(
      fc.property(fc.string(), fc.string(), (optionAlias, name) => {
        let xml: string;
        try {
          xml = write([{ P_Id: 10001, P_Phase: [optionAlias], P_Name: name }]);
        } catch (e) {
          // 弾くのは正しい倒れ方。ただし必ずライブラリのエラー型で（RV-36 と同じ契約）。
          expect(e).toBeInstanceOf(PortersError);
          return;
        }
        // 通したなら構造は呼び出し側の値に動かされていない。**生の文字列で数える**のが要点で、
        // パースして数えると、パーサ自身の都合（予約名の拒否など）が混ざって不変条件がぼやける。
        // 本文の位置に現れた "<Item>" はエスケープ済みなので、この数え方で取り違えは起きない。
        expect(count(xml, "<Item>")).toBe(1);
        expect(count(xml, "</Item>")).toBe(1);
        expect(count(xml, "<Person.P_Id>")).toBe(1);
      }),
    );
  });
});
