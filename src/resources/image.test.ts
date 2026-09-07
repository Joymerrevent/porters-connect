import { describe, expect, it } from "vitest";

import { applyImage } from "./image";

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
