import { describe, expect, it } from "vitest";

import {
  LV_DOC,
  check,
  markerBlocks,
  parseSummary,
} from "./check-live-verification.mjs";

// 実ファイルを読まずに検査するため、doc とコードを注入する。
// **受理側だけでなく棄却側も試す**のが要点 — 検査が「何も言わないだけ」で通っていないか
// 分からないので（check-doc-links.test.mjs と同じ規律）。
const run = (doc, files) => {
  const read = (path) => {
    if (path === LV_DOC) return doc;
    const text = files[path];
    if (text === undefined) throw new Error(`unexpected read: ${path}`);
    return text;
  };
  return check(read, () => Object.keys(files));
};

const doc = (rows, headings) =>
  [
    "| #     | 項目 | 状態   |",
    "| ----- | ---- | ------ |",
    ...rows,
    "",
    ...headings,
    "",
  ].join("\n");

describe("check-live-verification", () => {
  it("対応が取れていれば何も言わない", () => {
    expect(
      run(doc(["| LV-1 | あ | 未確認 |"], ["## LV-1 あ"]), {
        "src/a.ts": "// VERIFY(live): x — docs/live-verification.md (LV-1)\n",
      }),
    ).toEqual([]);
  });

  it("VERIFY(live) に番号が無ければ落とす（コード → LV の穴）", () => {
    const problems = run(doc(["| LV-1 | あ | 未確認 |"], ["## LV-1 あ"]), {
      "src/a.ts": "// VERIFY(live): 番号を書き忘れた\n",
      "src/b.ts": "// VERIFY(live): こちらは書いた (LV-1)\n",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("src/a.ts:1");
    expect(problems[0]).toContain("LV-N がありません");
  });

  it("存在しない LV を参照していれば落とす", () => {
    const problems = run(doc(["| LV-1 | あ | 未確認 |"], ["## LV-1 あ"]), {
      "src/a.ts": "// VERIFY(live): x (LV-1)\n// VERIFY(live): y (LV-99)\n",
    });
    expect(problems.some((p) => p.includes("LV-99"))).toBe(true);
  });

  it("未確認なのにマーカーが無ければ落とす（LV → コードの穴）", () => {
    const problems = run(
      doc(
        ["| LV-1 | あ | 未確認 |", "| LV-2 | い | 未確認 |"],
        ["## LV-1 あ", "## LV-2 い"],
      ),
      { "src/a.ts": "// VERIFY(live): x (LV-1)\n" },
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("LV-2");
    expect(problems[0]).toContain("未確認");
  });

  it("確定 / 解消 はマーカーが無くてよい（外すのが正しい）", () => {
    expect(
      run(
        doc(
          ["| LV-1 | あ | 確定 |", "| LV-2 | い | 解消 |"],
          ["## LV-1 あ", "## LV-2 い"],
        ),
        { "src/a.ts": "// 何も無い\n" },
      ),
    ).toEqual([]);
  });

  it("語彙外の状態を落とす（確定 と 解消 の取り違えを許さない）", () => {
    const problems = run(doc(["| LV-1 | あ | 済 |"], ["## LV-1 あ"]), {
      "src/a.ts": "// VERIFY(live): x (LV-1)\n",
    });
    expect(problems.some((p) => p.includes("語彙外"))).toBe(true);
  });

  it("表と見出しのズレを両方向で落とす", () => {
    expect(
      run(doc(["| LV-1 | あ | 解消 |"], []), {}).some((p) =>
        p.includes("本文の見出しがありません"),
      ),
    ).toBe(true);
    expect(
      run(doc([], ["## LV-1 あ"]), {}).some((p) => p.includes("表の書式")),
    ).toBe(true);
  });

  it("表が読めないときは、その 1 件だけ報告して打ち切る", () => {
    // 表の書式が変わったのに「対応は取れています」と言うのが最悪（検査の空振り）。
    const problems = run("見出しも表も無い", {});
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("1 つも読めませんでした");
  });

  describe("markerBlocks（どこまでが 1 つのマーカーか）", () => {
    it("コメントが続く限り同じ塊として読む", () => {
      const blocks = markerBlocks(
        "// VERIFY(live): 1 行目\n// 2 行目に LV-7 がある\nconst x = 1;\n",
      );
      expect(blocks).toHaveLength(1);
      expect(blocks[0].text).toContain("LV-7");
    });

    it("非コメント行で切る（次の塊の番号を自分のものにしない）", () => {
      const blocks = markerBlocks(
        "// VERIFY(live): 番号なし\nconst x = 1;\n// これは別の塊 (LV-7)\n",
      );
      expect(blocks).toHaveLength(1);
      expect(blocks[0].text).not.toContain("LV-7");
    });

    it("同じ塊の中に次のマーカーが来たらそこで切る", () => {
      const blocks = markerBlocks(
        "// VERIFY(live): 番号なし\n// VERIFY(live): こちらは (LV-7)\n",
      );
      expect(blocks).toHaveLength(2);
      expect(blocks[0].text).not.toContain("LV-7");
      expect(blocks[1].text).toContain("LV-7");
    });

    it("JSDoc の `*` 始まりも塊として読む", () => {
      const blocks = markerBlocks(
        "/**\n * VERIFY(live): x\n * 続き (LV-3)\n */\n",
      );
      expect(blocks[0].text).toContain("LV-3");
    });
  });

  describe("parseSummary", () => {
    it("番号と状態だけを読む（項目名の内容には依存しない）", () => {
      const rows = parseSummary(
        "| LV-1 | `P_Alias` は XML Name か | 未確認 |\n| LV-2 | あ | 確定 |\n",
      );
      expect(rows.get(1)).toBe("未確認");
      expect(rows.get(2)).toBe("確定");
    });
  });
});
