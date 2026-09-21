import { describe, expect, it } from "vitest";

import { kanaLines } from "./check-api-reference.mjs";

// 受理側だけでなく**棄却側も**試す。検査が「何も言わないだけ」で通っていないかは、
// 落ちることを見ないと分からない（check-live-verification.test.mjs と同じ規律）。
const tree = (files) => new Map(Object.entries(files));

describe("kanaLines（生成物の日本語検出・RV-51）", () => {
  it("英語だけなら何も言わない", () => {
    expect(
      kanaLines(tree({ "a.md": "The default is `-1` deliberately.\n" })),
    ).toEqual([]);
  });

  it("ひらがなを拾う", () => {
    const found = kanaLines(tree({ "a.md": "ok\nこれは日本語\n" }));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("a.md:2");
  });

  it("カタカナを拾う（RV-51 で実際に混ざっていた形）", () => {
    expect(
      kanaLines(
        tree({ "x.md": "await files.search({}); // メタデータだけ\n" }),
      ),
    ).toHaveLength(1);
  });

  it("長音符だけでも拾う（「サーバー」の一部が残る形）", () => {
    expect(kanaLines(tree({ "x.md": "ー\n" }))).toHaveLength(1);
  });

  it("**漢字は拾わない** — ADR の節番号や日本語のサンプル値で正当に出る", () => {
    // `案5b` / `論点4` は日本語 ADR の節を指す引用キーで、英訳すると参照先を辿れなくなる。
    // ここを弾くと「直しようのない指摘」になるので、意図的に対象外（判断は RV-51）。
    expect(
      kanaLines(
        tree({
          "a.md": "The resource names (ADR-0061 案5b).\n",
          "b.md": "Image cannot appear in a condition (ADR-0064 論点6).\n",
          "c.md": 'P_Title: "面談",\n',
        }),
      ),
    ).toEqual([]);
  });

  it("複数ファイル・複数行をすべて挙げる（1 件目で止まらない）", () => {
    const found = kanaLines(tree({ "a.md": "あ\nい\n", "b.md": "ok\nう\n" }));
    expect(found).toHaveLength(3);
    expect(found.map((f) => f.split(":")[0])).toEqual(["a.md", "a.md", "b.md"]);
  });

  it("行番号は 1 始まり、内容は trim して返す", () => {
    expect(kanaLines(tree({ "a.md": "  あ  \n" }))[0]).toBe("a.md:1: あ");
  });
});
