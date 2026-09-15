// リンク検査（`check-doc-links.mjs`）の受理/棄却をテストとして残す（RV-41）。
//
// なぜ要るか: この検査の形（「inline は `./` を要求する」「フェンスの中は見ない」など）は
// **実験して決めた**もので、理由は台帳に文章で残っているが**確かめる 1 行**が残っていなかった。
// ハーネスを `tmp/` に置くと gitignore で消え、次に触る人が同じ実験をやり直すことになる
// （`.claude/skills/change-review/references/verification-recipes.md` §1）。
//
// 置き場所: **スクリプトの隣**（`docs/design/basic-design.md` §2「UT は co-located」と同じ規律）。
// `scripts/` に初めて置くテストなので、以降ここに増やす。
//
// 検証の形: 一時 git リポジトリに md を書いて**スクリプトを実際に起動する**。
// 実在判定が `git ls-files` に依存する（＝OS の大文字小文字を避けるための設計）ので、
// 関数を切り出して呼ぶ形では**本番と同じ形にならない**。終了コードと出力で見る。

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("check-doc-links.mjs", import.meta.url));

// スクリプトは「必ずあるはずのファイル」が対象に入らないと空振りとして落ちる。
// どのケースでも土台として置く（空振りそのものを見るケースだけ null で落とす）。
const SENTINELS = {
  "README.md": "# README\n",
  "docs/usage/index.md": "# Usage\n",
};

const tempDirs = [];
afterEach(() => {
  let dir;
  while ((dir = tempDirs.pop()) !== undefined)
    rmSync(dir, { recursive: true, force: true });
});

/**
 * 一時 git リポジトリに `files`（パス → 中身。`null` は置かない）を書き、
 * そこを cwd にして検査を起動する。`staged` に挙げたパスは `git add` したうえで
 * 作業ツリーから消す（索引にあるのに読めない状態の再現）。
 */
const run = (files, { staged = [] } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "check-doc-links-"));
  tempDirs.push(dir);
  execFileSync("git", ["init", "-q"], { cwd: dir });
  for (const [path, body] of Object.entries({ ...SENTINELS, ...files })) {
    if (body === null) continue;
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  for (const path of staged) {
    execFileSync("git", ["add", "--", path], { cwd: dir });
    rmSync(join(dir, path));
  }
  try {
    const out = execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      encoding: "utf8",
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
};

/** 受理（緑）だったこと。落ちたときは出力ごと見せる（原因の特定に往復を要らせない）。 */
const expectAccepted = (result) => {
  expect(result.out).toContain("リンク先はすべて実在します");
  expect(result.code).toBe(0);
};

/** 棄却（赤）で、`報告` の文字列が出力に含まれること。 */
const expectRejected = (result, reported) => {
  expect(result.code).toBe(1);
  expect(result.out).toContain(reported);
};

describe("参照スタイルの定義", () => {
  it("`./` 付きの相対パスを見る", () => {
    expectAccepted(run({ "a.md": "[x]: ./b.md\n", "b.md": "# B\n" }));
    expectRejected(run({ "a.md": "[x]: ./gone.md\n" }), "a.md:1 -> ./gone.md");
  });

  it("`./` を付けない相対パスも見る", () => {
    expectAccepted(run({ "a.md": "[x]: b.md\n", "b.md": "# B\n" }));
    expectRejected(run({ "a.md": "[x]: gone.md\n" }), "a.md:1 -> gone.md");
  });

  it("親ディレクトリを辿る形を見る", () => {
    expectAccepted(run({ "docs/a/x.md": "[x]: ../usage/index.md\n" }));
    expectRejected(
      run({ "docs/a/x.md": "[x]: ../usage/gone.md\n" }),
      "docs/a/x.md:1 -> ../usage/gone.md",
    );
  });

  it("`<…>` 囲みの宛先を見る", () => {
    expectAccepted(run({ "a.md": "[x]: <./b.md>\n", "b.md": "# B\n" }));
    expectRejected(run({ "a.md": "[x]: <./gone.md>\n" }), "-> ./gone.md");
  });

  it("末尾のタイトル付き（3 形すべて）を見る", () => {
    for (const title of ['"T"', "'T'", "(T)"]) {
      expectAccepted(
        run({ "a.md": `[x]: ./b.md ${title}\n`, "b.md": "# B\n" }),
      );
      expectRejected(run({ "a.md": `[x]: ./gone.md ${title}\n` }), "./gone.md");
    }
  });

  it("3 字までの字下げを見る（4 字はコードブロック＝見ない）", () => {
    expectRejected(run({ "a.md": "   [x]: ./gone.md\n" }), "./gone.md");
    expectAccepted(run({ "a.md": "    [x]: ./gone.md\n" }));
  });

  it("ディレクトリを指す形を受理する", () => {
    expectAccepted(run({ "a.md": "[x]: ./docs/usage\n" }));
    expectAccepted(run({ "a.md": "[x]: ./docs/usage/\n" }));
    expectRejected(run({ "a.md": "[x]: ./docs/gone/\n" }), "./docs/gone/");
  });

  it("外部・プロトコル相対は対象外", () => {
    expectAccepted(
      run({
        "a.md": [
          "[h]: https://example.com/gone.md",
          "[m]: mailto:x@example.com",
          "[p]: //example.com/gone.md",
          "",
        ].join("\n"),
      }),
    );
  });

  it("宛先が 1 語なら散文でも宛先として扱う（CommonMark の定義そのもの）", () => {
    // `[注]: これは説明です` は CommonMark では**リンク参照定義**（宛先=「これは説明です」）。
    // 報告されるのが正しい。空白を含む散文は定義として成立しないので拾わない。
    expectRejected(run({ "a.md": "[注]: これは説明です\n" }), "これは説明です");
    expectAccepted(run({ "a.md": "[注]: これは 説明です\n" }));
  });

  it("リポジトリ外を許した接頭辞は数えるだけ", () => {
    // 解決後のパスで判定するので、リポジトリ内から `tmp/` に落ちる形で置く。
    const r = run({ "docs/a.md": "[x]: ../tmp/porters-docs/foo.md\n" });
    expectAccepted(r);
    expect(r.out).toContain("リンク先はすべて実在します");
    expect(r.out).toContain("対象外");
  });
});

describe("inline リンク", () => {
  it("`./` 付きを見る", () => {
    expectAccepted(run({ "a.md": "[x](./b.md)\n", "b.md": "# B\n" }));
    expectRejected(run({ "a.md": "[x](./gone.md)\n" }), "a.md:1 -> ./gone.md");
  });

  it("`./` を付けない形も見る（RV-38）", () => {
    expectAccepted(run({ "a.md": "[x](b.md)\n", "b.md": "# B\n" }));
    expectRejected(run({ "a.md": "[x](gone.md)\n" }), "a.md:1 -> gone.md");
    expectRejected(
      run({ "docs/a.md": "[x](usage/gone.md)\n" }),
      "docs/a.md:1 -> usage/gone.md",
    );
  });

  it("タイトル付き（3 形すべて）と `<…>` 囲みも見る（RV-38）", () => {
    for (const title of ['"T"', "'T'", "(T)"]) {
      expectAccepted(
        run({ "a.md": `[x](./b.md ${title})\n`, "b.md": "# B\n" }),
      );
      expectRejected(run({ "a.md": `[x](./gone.md ${title})\n` }), "./gone.md");
    }
    expectAccepted(run({ "a.md": "[x](<./b.md>)\n", "b.md": "# B\n" }));
    expectRejected(run({ "a.md": "[x](<./gone.md>)\n" }), "./gone.md");
  });

  it("allowlist に無い拡張子は `./` を付けたときだけ見る（RV-38）", () => {
    expectRejected(run({ "a.md": "[x](./gone.docx)\n" }), "./gone.docx");
    expectAccepted(run({ "a.md": "[x](gone.docx)\n" }));
  });

  it("リンクではない散文を拾わない", () => {
    // `./` 無しを拾うようにしたので（RV-38）、ここが誤検出の境目になる。
    // いずれもリポジトリに実在する形。
    expectAccepted(
      run({
        "a.md": [
          "見出し `Field Alias` の説明: `condition`",
          "文章の途中に ](…) が出てくる形",
          "項目一覧 ]([Field Alias],[Field Alias]...) の形",
          "拡張子の無い語 ](candidate) の形",
          "読点を含む形 ](a, b) の形",
          "",
        ].join("\n"),
      }),
    );
  });

  it("コードスパンの中は見ない（RV-40）", () => {
    // リンクの書き方を説明する文章が、説明しただけで報告されないこと。
    expectAccepted(
      run({ "a.md": "説明: `[x](./gone.md)` のように書きます。\n" }),
    );
    expectAccepted(run({ "a.md": "定義: `[x]: ./gone.md` と書きます。\n" }));
  });

  it("コードスパンを潰しても行の構造が動かない（RV-40）", () => {
    // 中身は空白に置換する＝列がずれないので、同じ行の**外**にあるリンクは見る。
    expectRejected(
      run({ "a.md": "`[x](./safe.md)` と [y](./gone.md)\n" }),
      "a.md:1 -> ./gone.md",
    );
    // 行頭の定義は、同じ行のタイトルにコードスパンがあっても拾える。
    expectRejected(
      run({ "a.md": '[x]: ./gone.md "`code` のタイトル"\n' }),
      "a.md:1 -> ./gone.md",
    );
  });

  it("閉じていないバッククォートはコードスパンにしない（RV-40）", () => {
    // 1 個だけのバッククォートで以降が全部消えると、その行のリンクが黙って検査されなくなる。
    expectRejected(
      run({ "a.md": "` は 1 個だけ。[y](./gone.md)\n" }),
      "a.md:1 -> ./gone.md",
    );
  });

  it("入れ子のコードスパン（`` で ` を囲む）で開閉が逆転しない（RV-40）", () => {
    expectAccepted(run({ "a.md": "説明: `` `[x](./gone.md)` `` と書く\n" }));
  });
});

describe("コードフェンス", () => {
  it("フェンスの中は見ない", () => {
    expectAccepted(
      run({ "a.md": "```md\n[x]: ./gone.md\n[y](./gone.md)\n```\n" }),
    );
    expectAccepted(run({ "a.md": "~~~md\n[x]: ./gone.md\n~~~\n" }));
  });

  it("入れ子のフェンス（```` で ``` を囲む）で開閉が逆転しない", () => {
    expectRejected(
      run({
        "a.md": [
          "````md",
          "```",
          "[x]: ./inner.md",
          "```",
          "````",
          "[y]: ./gone.md",
          "",
        ].join("\n"),
      }),
      "a.md:6 -> ./gone.md",
    );
  });

  it("閉じていないフェンスを開始行つきで報告する", () => {
    const r = run({ "a.md": "本文\n```md\n[x]: ./gone.md\n" });
    expectRejected(r, "コードフェンスが閉じていません");
    expect(r.out).toContain("a.md:2");
  });
});

describe("アンカー", () => {
  it("リンク先の見出しの実在まで見る（RV-39）", () => {
    expectAccepted(run({ "a.md": "[x]: ./b.md#b\n", "b.md": "# B\n" }));
    const r = run({ "a.md": "[x]: ./b.md#gone\n", "b.md": "# B\n" });
    expectRejected(r, "見出しが見つかりません");
    expect(r.out).toContain("a.md:1 -> ./b.md#gone");
  });

  it("ファイルが無いときは見出しではなくファイルを報告する", () => {
    const r = run({ "a.md": "[x]: ./gone.md#b\n" });
    expectRejected(r, "リンク先が見つかりません");
    expect(r.out).not.toContain("見出しが見つかりません");
  });

  it("同一ページ内アンカーも同じ経路で見る（RV-39）", () => {
    expectAccepted(run({ "a.md": "# A\n\n[x]: #a\n" }));
    expectRejected(run({ "a.md": "# A\n\n[x]: #gone\n" }), "a.md:3 -> #gone");
  });

  it("GitHub の slug 規則に合わせる（句読点を落としてから空白を `-` に）", () => {
    // 実在するリンクの形。`()` を落としたあと空白 2 つが `--` になる。
    expectAccepted(
      run({
        "a.md":
          "## LV-17 Phase の User 項目を `()` 付きで要求できるか\n\n[x]: #lv-17-phase-の-user-項目を--付きで要求できるか\n",
      }),
    );
    // `[` `]` は落ちる／大文字は小文字になる。
    expectAccepted(
      run({
        "a.md":
          "## LV-10 System[Reference] Read の入れ子タグ\n\n[x]: #lv-10-systemreference-read-の入れ子タグ\n",
      }),
    );
  });

  it("見出しの中のリンクは表示テキストで slug を作る", () => {
    expectAccepted(
      run({
        "a.md":
          "## [ADR-0048][adr] の改訂\n\n[x]: #adr-0048-の改訂\n[adr]: ./b.md\n",
        "b.md": "# B\n",
      }),
    );
  });

  it("同じ見出しが 2 つあれば 2 つ目は `-1`（GitHub の重複規則）", () => {
    expectAccepted(
      run({ "a.md": "## 概要\n\n## 概要\n\n[x]: #概要\n[y]: #概要-1\n" }),
    );
    expectRejected(run({ "a.md": "## 概要\n\n[y]: #概要-1\n" }), "#概要-1");
  });

  it("percent-encoded なアンカーも戻して突き合わせる", () => {
    expectAccepted(
      run({
        "a.md": `# 概要\n\n[x]: #${encodeURIComponent("概要")}\n`,
      }),
    );
  });

  it("フェンスの中の `#` は見出しにしない", () => {
    expectRejected(
      run({ "a.md": "```sh\n# 見出しではない\n```\n\n[x]: #見出しではない\n" }),
      "見出しが見つかりません",
    );
  });

  it("明示アンカー（`<a id=…>`）も宛先として認める", () => {
    expectAccepted(run({ "a.md": '<a id="ここ"></a>\n\n[x]: #ここ\n' }));
  });

  it("setext 見出しも拾う（多く拾う側に倒す）", () => {
    expectAccepted(run({ "a.md": "概要\n===\n\n[x]: #概要\n" }));
  });

  it("md 以外とディレクトリのアンカーは見ない", () => {
    expectAccepted(
      run({
        "a.md": "[x]: ./b.mjs#L10\n[y]: ./docs/usage#anything\n",
        "b.mjs": "// code\n",
      }),
    );
  });

  it("近い見出しを候補として出す", () => {
    const r = run({
      "a.md": "## Decision Outcome\n\n[x]: #decision-outcomes\n",
    });
    expectRejected(r, "見出しが見つかりません");
    expect(r.out).toContain("近い見出し: #decision-outcome");
  });
});

describe("検査そのものの健全性", () => {
  it("必ずあるはずのファイルが対象に無ければ空振りとして落ちる", () => {
    const r = run({ "docs/usage/index.md": null });
    expectRejected(r, "検査が空振りしています");
    expect(r.out).toContain("docs/usage/index.md");
  });

  it("索引にあるのに読めないファイルを報告する（`git rm` 忘れ）", () => {
    const r = run({ "a.md": "# A\n" }, { staged: ["a.md"] });
    expectRejected(r, "索引にあるのに読めないファイルがあります");
    expect(r.out).toContain("a.md");
  });

  it("3 種類の異常を 1 回の実行で全部出す", () => {
    const r = run(
      { "a.md": "```md\n", "b.md": "[x]: ./gone.md\n", "c.md": "# C\n" },
      { staged: ["c.md"] },
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("索引にあるのに読めないファイルがあります");
    expect(r.out).toContain("コードフェンスが閉じていません");
    expect(r.out).toContain("リンク先が見つかりません");
  });

  it("除外した件数を赤いときも出す", () => {
    const r = run({
      "docs/a.md": "[x]: ../tmp/porters-docs/foo.md\n[y]: ./gone.md\n",
    });
    expectRejected(r, "リンク先が見つかりません");
    expect(r.out).toContain("対象外");
  });
});
