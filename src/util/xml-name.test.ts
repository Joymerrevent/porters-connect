import { describe, expect, it } from "vitest";
import { isXmlName } from "./xml-name";

describe("isXmlName", () => {
  it.each([
    ["Option.P_SE", "出典どおりの選択肢 alias"],
    ["Option.P_PersonPhase_Applied", "下線を含む"],
    ["P_Tokyo", "接頭辞なし（LV-1 が未確定なのでこちらも通す）"],
    ["Person.P_Name", "Write の項目 alias（接頭辞つき）"],
    ["Id", "Phase の裸 alias"],
    ["Option.P_東京", "日本語 — テナントが作る選択肢は ASCII とは限らない"],
    ["_leading", "下線始まり"],
    ["a", "1 文字"],
    ["A.B-C_1", "2 文字目以降は `-` `.` 数字も使える"],
    ["\u{20BB7}z", "サロゲートペア（U+20BB7）は NameStartChar"],
  ])("accepts %j (%s)", (value) => {
    expect(isXmlName(value)).toBe(true);
  });

  it.each([
    ["", "空文字"],
    ["1leading", "数字始まりは NameStartChar ではない"],
    ["-leading", "`-` 始まりも同じ"],
    [".leading", "`.` 始まりも同じ"],
    ["has space", "空白"],
    ["a\tb", "タブ"],
    ["a\nb", "改行"],
    ["a<b", "`<` — 注入に要る文字"],
    ["a>b", "`>` — 同上"],
    ["a/b", "`/` — 同上"],
    ['a"b', '`"` — 同上'],
    ["a&b", "`&` — 実体参照の開始"],
    ["a'b", "アポストロフィ"],
    ["a=b", "`=`"],
    ["×", "U+00D7（×）は NameStartChar の穴（C0-D6 と D8-F6 の間）"],
    [";", "U+037E（;）は 370-37D と 37F- の間の穴"],
  ])("rejects %j (%s)", (value) => {
    expect(isXmlName(value)).toBe(false);
  });

  it("rejects the injection payload from RV-48", () => {
    // RV-48 の実測で使った文字列。これが要素名の位置に入ると `<Item>` が注入できた。
    expect(
      isXmlName(
        "Option.P_Applied/></Person.P_Phase><Person.P_Id>999</Person.P_Id></Item>" +
          "<Item><Person.P_Name>pwned</Person.P_Name><Person.P_Phase><Option.P_Applied",
      ),
    ).toBe(false);
  });

  it("accepts a digit or `-` after the first character but not as the first", () => {
    // 境界: 同じ文字でも位置で可否が変わる（NameStartChar ⊂ NameChar）。
    expect(isXmlName("a1")).toBe(true);
    expect(isXmlName("1a")).toBe(false);
    expect(isXmlName("a-")).toBe(true);
    expect(isXmlName("-a")).toBe(false);
  });
});
