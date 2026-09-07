import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import type { DataType, ImageSubField } from "../xml/decode";
import type { ImageWriteValue } from "../xml/encode";
import { applyImage, guardImageWrite, guardNoImageInBulk } from "./image";

// Unit-level counterpart to the wiring tests in resource.test.ts: those drive the option through
// the resource factory (does a search send the right `field`), this pins the one piece this module
// owns. The prefix cases matter because Phase has none (ADR-0061) — `qualify` handles that, and a
// selection must not turn `U_photo` into `.U_photo`.
describe("applyImage — image を field 文字列に畳む（ADR-0064 論点2）", () => {
  it("選んだ項目の素のエントリを () 付きに置き換える（重複して送らない）", () => {
    expect(
      applyImage(
        ["Resume.P_Id", "Resume.U_photo", "Resume.P_Name"],
        { U_photo: ["FileName", "Content"] },
        "Resume",
      ),
    ).toEqual([
      "Resume.P_Id",
      "Resume.U_photo(FileName,Content)",
      "Resume.P_Name",
    ]);
  });

  it("field を自分で絞って素のエントリが無いときは足す", () => {
    expect(
      applyImage(["Resume.P_Id"], { U_photo: ["Content"] }, "Resume"),
    ).toEqual(["Resume.P_Id", "Resume.U_photo(Content)"]);
  });

  it("接頭辞を持たないリソースでは素の alias のまま括弧を付ける", () => {
    expect(applyImage(["U_photo"], { U_photo: ["FileName"] }, "")).toEqual([
      "U_photo(FileName)",
    ]);
  });

  it("選択が空 / 未指定なら何も変えない（PORTERS 既定の FileName のみに委ねる）", () => {
    const entries = ["Resume.U_photo"];
    expect(applyImage(entries, { U_photo: [] }, "Resume")).toEqual(entries);
    expect(applyImage(entries, { U_photo: undefined }, "Resume")).toEqual(
      entries,
    );
    expect(applyImage(entries, undefined, "Resume")).toEqual(entries);
  });

  it("入力の配列を書き換えない", () => {
    const entries = ["Resume.U_photo"];
    applyImage(entries, { U_photo: ["Content"] }, "Resume");
    expect(entries).toEqual(["Resume.U_photo"]);
  });
});

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

  it("Base64 のパディングを差し引いて実バイト数を測る（境界）", () => {
    // 2MB ちょうど = 2097152 バイト。パディングありの表現でも「ちょうど」は通す。
    const exact = "A".repeat((2 * 1024 * 1024) / 3 - 1); // 端数のない長さ
    expect(() =>
      guardImageWrite({ U_photo: image({ Content: exact }) }, FIELDS),
    ).not.toThrow();
    // パディング 1 / 2 文字は 1 / 2 バイト少ない＝上限ぎりぎりの判定がずれない
    expect(
      guardImageWrite({ U_photo: image({ Content: `${exact}=` }) }, FIELDS),
    ).toBe(true);
    expect(
      guardImageWrite({ U_photo: image({ Content: `${exact}==` }) }, FIELDS),
    ).toBe(true);
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
