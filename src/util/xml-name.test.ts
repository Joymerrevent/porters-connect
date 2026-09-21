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

  // NameStartChar は範囲の**寄せ集め**で、1 つ落としても ASCII と日本語しか試さない限り
  // 気づけない（実際、最初この試験が無くて範囲を消す変異が生き残った）。各範囲から
  // 1 文字ずつ当てて、どの範囲も効いていることを押さえる。
  it.each([
    ["\u00C0", "À — #xC0-#xD6"],
    ["\u00F8", "ø — #xF8-#x2FF の下端側"],
    ["\u0259", "ə — #xF8-#x2FF"],
    ["\u0372", "Ͳ — #x370-#x37D"],
    ["\u03A9", "Ω — #x37F-#x1FFF（ギリシャ）"],
    ["\u0416", "Ж — #x37F-#x1FFF（キリル）"],
    ["\u200C", "ZWNJ — #x200C-#x200D"],
    ["\u2180", "ↀ — #x2070-#x218F"],
    ["\u2C00", "Ⰰ — #x2C00-#x2FEF"],
    ["\u3042", "あ — #x3001-#xD7FF"],
    ["\uF900", "豈 — #xF900-#xFDCF"],
    ["\uFDF0", "ﷰ — #xFDF0-#xFFFD"],
  ])("accepts %j as a NameStartChar (%s)", (value) => {
    expect(isXmlName(value)).toBe(true);
  });

  // NameChar だけにある範囲（先頭には置けないが 2 文字目以降なら通る）。
  it.each([
    ["\u00B7", "· — 中黒"],
    ["\u0301", "結合アキュート — #x300-#x36F"],
    ["\u203F", "‿ — #x203F-#x2040"],
  ])("accepts %j only after the first character (%s)", (value) => {
    expect(isXmlName(`a${value}`)).toBe(true);
    expect(isXmlName(value)).toBe(false);
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
