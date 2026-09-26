import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import type { DataType } from "../porters/data-type";
import type { ImageSubField } from "../xml/field-value";
import type { ImageWriteValue } from "../xml/write-value";
import { guardImageWrite, guardNoImageInBulk } from "./guard-image-write";

const FIELDS = new Map<string, DataType | null>([
  ["P_Name", "SinglelineText"],
  ["U_photo", "Image"],
]);

// A valid Base64 image value, small enough to pass every limit. The cast is for the tests that
// deliberately hand over an invalid value — the static type stops those, the guard is what
// catches them when a cast slips one through.
const image = (over: Partial<Record<ImageSubField, string>> = {}) =>
  ({
    FileName: "photo.png",
    ContentType: "image/png",
    Content: "QUJD",
    ...over,
  }) as ImageWriteValue;

// 4 Base64 chars carry 3 bytes: this is just over 2MB decoded.
const overSizedContent = "A".repeat(Math.ceil(((2 * 1024 * 1024 + 1) / 3) * 4));

describe("guardImageWrite — 送信前に PORTERS の 3 つの上限を検査する（ADR-0064 論点3）", () => {
  it("画像を含まない書き込みでは false（サイズガードを外さない）", () => {
    expect(guardImageWrite({ P_Name: "x" }, FIELDS)).toBe(false);
    // null / undefined は項目を送らない＝検査するものが無い
    expect(guardImageWrite({ U_photo: null }, FIELDS)).toBe(false);
  });

  it("正しい画像なら true（＝この write だけサイズガードを外す）", () => {
    expect(guardImageWrite({ U_photo: image() }, FIELDS)).toBe(true);
  });

  it("decode 後 2MB を超える Content を送信前に弾く", () => {
    expect(() =>
      guardImageWrite(
        { U_photo: image({ Content: overSizedContent }) },
        FIELDS,
      ),
    ).toThrow(PortersConfigError);
    expect(() =>
      guardImageWrite(
        { U_photo: image({ Content: overSizedContent }) },
        FIELDS,
      ),
    ).toThrow(/over the 2MB limit/);
  });

  it("Base64 のパディングを差し引いて実バイト数を測る（2MB の境界）", () => {
    // 2MB = 2097152 バイト = 699050 グループ × 3 バイト ＋ 2 バイト。Base64 では 699050 グループ
    // （2796200 文字）に「AAA=」（2 バイト）を足した形が「ちょうど 2MB」になる。
    // 以前の境界テストは長さの計算が違い（2MB の 1/4 で「ちょうど」と書いていた）、
    // パディングを無視しても `>` を `>=` にしても通ってしまっていた（survivor 5 件）。
    const groups = "A".repeat(2796200); // 2097150 バイト
    const at = (tail: string) =>
      guardImageWrite(
        { U_photo: image({ Content: `${groups}${tail}` }) },
        FIELDS,
      );
    expect(at("AAA=")).toBe(true); // 2097152 = ちょうど 2MB は通す（上限は「超えたら」）
    expect(at("AA==")).toBe(true); // 2097151（パディング 2 文字 = 2 バイト減）
    expect(() => at("AAAA")).toThrow(
      /2097153 bytes once decoded, over the 2MB limit/,
    ); // 1 バイト超過
    // 2MB 前後では「=」と「==」の差 1 バイトが合否を分ける長さが無い（3g−2 = 2MB を満たす g が
    // 整数にならない）ので、「==」の読み方はエラー文の実測バイト数で pin する。
    expect(() => at("AAAAAA==")).toThrow(/2097154 bytes once decoded/); // 2 グループ ＝ 6−2 バイト
  });

  it("上限超過のエラーは category config（呼び出し側の値・送信前）", () => {
    expect(() =>
      guardImageWrite(
        { U_photo: image({ Content: overSizedContent }) },
        FIELDS,
      ),
    ).toThrow(
      expect.objectContaining({
        category: "config",
        hint: expect.stringContaining("2MB or less") as string,
      }),
    );
  });

  it("hint が上限の直し方を言う（ファイル名はバイト数・mime は許される 4 種）", () => {
    expect(() =>
      guardImageWrite(
        { U_photo: image({ FileName: "あ".repeat(86) }) },
        FIELDS,
      ),
    ).toThrow(
      expect.objectContaining({
        hint: expect.stringContaining("255 bytes or fewer") as string,
      }),
    );
    expect(() =>
      guardImageWrite(
        { U_photo: image({ ContentType: "image/webp" }) },
        FIELDS,
      ),
    ).toThrow(
      expect.objectContaining({
        hint: expect.stringContaining(
          "image/jpeg / image/gif / image/png / image/bmp",
        ) as string,
      }),
    );
  });

  // 型を迂回した値は、"null" などの文字列として送られていた。3 つとも文字列であることを求める（RV-98）。
  it.each([
    [{ FileName: "a.png", ContentType: "image/png" }, "Content", "undefined"],
    [{ ContentType: "image/png", Content: "QUJD" }, "FileName", "undefined"],
    [{ FileName: "a.png", Content: "QUJD" }, "ContentType", "undefined"],
    [
      { FileName: "a.png", ContentType: "image/png", Content: null },
      "Content",
      "null",
    ],
    [
      { FileName: ["x".repeat(300)], ContentType: "image/png", Content: "" },
      "FileName",
      "object",
    ],
  ])("refuses %j before sending", (v, sub, got) => {
    let err: unknown;
    try {
      guardImageWrite({ U_photo: v as unknown as ImageWriteValue }, FIELDS);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).message).toBe(
      `image "U_photo" must have ${sub} as a string, got ${got}`,
    );
    expect((err as PortersConfigError).hint).toBe(
      "Write an image as { FileName, ContentType, Content }, with Content the file as Base64 (see bytesToBase64).",
    );
  });

  it("accepts empty strings, which PORTERS' handling of is only unverified", () => {
    expect(
      guardImageWrite(
        { U_photo: { FileName: "", ContentType: "image/png", Content: "" } },
        FIELDS,
      ),
    ).toBe(true);
  });

  // 改行入りの Base64 は、改行を除いて大きさを数える（RV-98）。
  it("measures Base64 with line breaks by its content only", () => {
    // ちょうど 2MB（2796200 文字 ＋ "AAA="）を、MIME の形（76 文字ごとに CRLF）で折り返す。
    const exactly2MB = `${"A".repeat(2796200)}AAA=`;
    const wrapped = (exactly2MB.match(/.{1,76}/g) ?? []).join("\r\n");
    expect(
      guardImageWrite(
        {
          U_photo: {
            FileName: "a.png",
            ContentType: "image/png",
            Content: wrapped,
          },
        },
        FIELDS,
      ),
    ).toBe(true);
    expect(() =>
      guardImageWrite(
        {
          U_photo: {
            FileName: "a.png",
            ContentType: "image/png",
            Content: `${wrapped}\r\nAAAA`,
          },
        },
        FIELDS,
      ),
    ).toThrow(/over the 2MB limit/);
  });

  it("Image 型の項目に文字列が渡されても（cast 経由）オブジェクトとしては検査しない", () => {
    // `typeof value === "object"` を外すと文字列を分解しようとして通ってしまう（WriteItem は
    // 文字列を受けるので、Image 型の項目に文字列が届く形は型の上でも存在する）。
    expect(guardImageWrite({ U_photo: "QUJD" }, FIELDS)).toBe(false);
  });

  it("255 バイトを超えるファイル名を弾く（文字数ではなくバイト数）", () => {
    // 86 文字 × 3 バイト = 258 バイト。文字数だけ見ていると通ってしまう。
    const name = "あ".repeat(86);
    expect(() =>
      guardImageWrite({ U_photo: image({ FileName: name }) }, FIELDS),
    ).toThrow(/258-byte file name/);
    // 境界: 255 バイト（85 文字）はそのまま通る
    expect(
      guardImageWrite(
        { U_photo: image({ FileName: "あ".repeat(85) }) },
        FIELDS,
      ),
    ).toBe(true);
  });

  it("PORTERS が受けない mime を弾く", () => {
    expect(() =>
      guardImageWrite(
        { U_photo: image({ ContentType: "image/webp" }) },
        FIELDS,
      ),
    ).toThrow(/does not accept/);
    for (const mime of ["image/jpeg", "image/gif", "image/png", "image/bmp"]) {
      expect(
        guardImageWrite({ U_photo: image({ ContentType: mime }) }, FIELDS),
      ).toBe(true);
    }
  });

  it("Image 型でない項目のオブジェクト値は対象外（カタログで判断する）", () => {
    expect(
      guardImageWrite({ P_Name: image({ ContentType: "image/webp" }) }, FIELDS),
    ).toBe(false);
  });
});

describe("guardNoImageInBulk — 一括書き込みは画像を運ばない（ADR-0064 論点3）", () => {
  it("画像を含まなければ通す", () => {
    expect(() =>
      guardNoImageInBulk(
        [{ P_Name: "a" }, { P_Name: "b" }],
        FIELDS,
        "createMany",
      ),
    ).not.toThrow();
  });

  it("画像を含む一括書き込みを、何件目かを添えて弾く", () => {
    expect(() =>
      guardNoImageInBulk(
        [{ P_Name: "a" }, { U_photo: image() }],
        FIELDS,
        "createMany",
      ),
    ).toThrow(/createMany cannot write an image \(record 1 carries one\)/);
  });

  it("単発の create / update へ誘導する", () => {
    try {
      guardNoImageInBulk([{ U_photo: image() }], FIELDS, "updateMany");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(PortersConfigError);
      expect((e as PortersConfigError).hint).toMatch(
        /create\(\) \/ update\(\)/,
      );
    }
  });
});
