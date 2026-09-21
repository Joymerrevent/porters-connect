import { describe, expect, it } from "vitest";

import { kanaLines, maintainerIdLines } from "./check-api-reference.mjs";

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

  it("**漢字は拾わない** — 日本語のサンプル値で正当に出る", () => {
    // `P_Title: "面談"` のようなサンプル値は漢字で現れる。ここを弾くと「直しようのない指摘」に
    // なるので、意図的に対象外（判断は RV-51）。ADR の節番号（`案5b`）も漢字だが、それは
    // 番号本体ごと maintainerIdLines が拾う。
    expect(
      kanaLines(
        tree({
          "a.md": "The resource names (ADR-0061 案5b).\n",
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

describe("maintainerIdLines（生成物の保守者向け識別子検出）", () => {
  it("識別子が無ければ何も言わない", () => {
    expect(
      maintainerIdLines(
        tree({
          "a.md":
            "Bind a partition (Company DB) and get the accessors that route through it.\n",
          // 利用者向けドキュメントへのパスは対象外（docs/usage は利用者が読む）。
          "b.md": "See docs/usage/concepts/limits.md.\n",
        }),
      ),
    ).toEqual([]);
  });

  it("ADR 番号を拾う（節番号付きも含む）", () => {
    const found = maintainerIdLines(
      tree({
        "a.md": "The resource names (ADR-0061 案5b).\n",
        "b.md": "Auto-batched (ADR-0041 / F-4).\n",
      }),
    );
    expect(found.map((f) => f.split(":")[0])).toEqual(["a.md", "b.md"]);
  });

  it("ADR 番号を伴わない節番号も拾う（`(案5b)` は実際に生成物に出ていた形）", () => {
    expect(
      maintainerIdLines(
        tree({
          "a.md": "the precise static Write type (SD-3).\n",
          "b.md": "bound once (F-3).\n",
          "c.md": "so it is bound once (案2a).\n",
          "d.md": "Never silently dropped (論点4).\n",
          "e.md": "decided on accept (決定3).\n",
        }),
      ),
    ).toHaveLength(5);
  });

  it("`docs/usage/` 以外の `docs/` パスを拾う（allowlist）", () => {
    expect(
      maintainerIdLines(
        tree({
          "a.md": "see docs/design/basic-design.md\n",
          "b.md": "see docs/roadmap.md\n",
          "c.md": "(docs/history/SPEC_v1.md)\n",
          "d.md": "`../docs/adr/0064-image.md`\n",
          "e.md":
            "https://github.com/Joymerrevent/porters-connect/blob/main/docs/adr/0064-image.md\n",
        }),
      ),
    ).toHaveLength(5);
  });

  it("外部サイトの `/docs/` パスは拾わない（typedoc が Error から継承して描く URL）", () => {
    // 実際に落ちた形: https://v8.dev/docs/stack-trace-api#customizing-stack-traces
    expect(
      maintainerIdLines(
        tree({
          "a.md":
            "https://v8.dev/docs/stack-trace-api#customizing-stack-traces\n",
          "b.md": "https://example.com/docs/adr/whatever\n",
          "c.md":
            "https://github.com/Joymerrevent/porters-connect/blob/main/docs/usage/concepts/limits.md\n",
        }),
      ),
    ).toEqual([]);
  });

  it("レビュー指摘（RV）と実機確認（LV）の番号を拾う", () => {
    expect(
      maintainerIdLines(
        tree({
          "a.md": "rejected at construction rather than hanging (RV-49).\n",
          "b.md": "docs/live-verification.md (LV-22).\n",
        }),
      ),
    ).toHaveLength(2);
  });

  it("VERIFY(live) の印と台帳へのパスを拾う", () => {
    expect(
      maintainerIdLines(
        tree({
          "a.md": "VERIFY(live): there is no way to clear an image.\n",
          "b.md": "see docs/adr/0064-image.md\n",
          "c.md": "see docs/reviews/2026-09-21.md\n",
        }),
      ),
    ).toHaveLength(3);
  });

  it("似た綴りの英単語や型名は拾わない", () => {
    // `System[Reference]` / `verifyFields` / `MADR-0001` / `UTF-8` のような語で誤検知しない。
    // 漢字のサンプル値も、数字が続かない限り対象外（`面談` / `案` 単独）。
    expect(
      maintainerIdLines(
        tree({
          "a.md":
            "An expanded System[Reference] value; check it with verifyFields.\n",
          "b.md": "MADR-0001 is not ours; neither is XRV-1 nor SLV-2.\n",
          "c.md": "A UTF-8 name; PDF-1 is not a section either.\n",
          "d.md": 'P_Title: "面談", P_Memo: "案",\n',
        }),
      ),
    ).toEqual([]);
  });

  it("行番号は 1 始まり、内容は trim して返す", () => {
    expect(maintainerIdLines(tree({ "a.md": "  (ADR-0001)  \n" }))[0]).toBe(
      "a.md:1: (ADR-0001)",
    );
  });
});
