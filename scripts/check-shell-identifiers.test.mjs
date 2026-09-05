import { describe, expect, it } from "vitest";

import {
  checkSource,
  collectShellFiles,
  OFFENDING,
} from "./check-shell-identifiers.mjs";

describe("checkSource", () => {
  it("実際に踏んだ形（$var の直後に全角の閉じ括弧）を検出する", () => {
    const problems = checkSource(
      "a.sh",
      'say "  ❌ open ではありません（$state）"',
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      path: "a.sh",
      line: 1,
      found: "$state",
      suggestion: "${state}",
    });
  });

  it("${var} と括ってあれば検出しない（これが直し方）", () => {
    expect(
      checkSource("a.sh", 'say "  ❌ open ではありません（${state}）"'),
    ).toEqual([]);
  });

  it("直後が ASCII なら検出しない", () => {
    expect(checkSource("a.sh", 'echo "state=$state, base=$base"')).toEqual([]);
  });

  it("全角の開き括弧・読点・中黒など閉じ括弧以外でも検出する", () => {
    const problems = checkSource(
      "a.sh",
      ['echo "$a（開き"', 'echo "$b、読点"', 'echo "$c・中黒"'].join("\n"),
    );
    expect(problems.map((p) => p.found)).toEqual(["$a", "$b", "$c"]);
    expect(problems.map((p) => p.line)).toEqual([1, 2, 3]);
  });

  it("1 行に複数あればすべて拾う", () => {
    const problems = checkSource("a.sh", 'echo "$a、と $b。"');
    expect(problems.map((p) => p.found)).toEqual(["$a", "$b"]);
  });

  it("直後が半角スペースなら安全（実際に踏んだ行の前半がこれ）", () => {
    // `（指紋 $prev_fp → $fingerprint）` では $prev_fp の後ろは空白なので無害、
    // 全角の閉じ括弧が直後に来る $fingerprint だけが変数名に吸われる。
    const problems = checkSource(
      "a.sh",
      'emit reason "状況が変わりました（指紋 $prev_fp → $fingerprint）"',
    );
    expect(problems.map((p) => p.found)).toEqual(["$fingerprint"]);
  });

  it("行番号と該当行のテキストを添えて返す", () => {
    const problems = checkSource(
      "a.sh",
      ["#!/bin/bash", "", 'x="$v。"'].join("\n"),
    );
    expect(problems[0].line).toBe(3);
    expect(problems[0].text).toBe('x="$v。"');
  });

  it("問題が無ければ空配列を返す", () => {
    expect(checkSource("a.sh", "echo hello\nexit 0")).toEqual([]);
  });

  it("$1 のような位置パラメータは対象外（変数名は英字/下線始まり）", () => {
    expect(checkSource("a.sh", 'echo "$1（第一引数）"')).toEqual([]);
  });
});

describe("OFFENDING", () => {
  it("グローバルフラグを持つ（1 行に複数ある場合に取りこぼさないため）", () => {
    expect(OFFENDING.global).toBe(true);
  });
});

describe("collectShellFiles", () => {
  // 実ファイルを読まずに走査ロジックだけ見るため、readdir/stat を注入する。
  const TREE = {
    ".": ["a.sh", "b.txt", "node_modules", "sub"],
    node_modules: ["evil.sh"],
    sub: ["c.sh"],
  };
  const fakeFs = {
    readdirSync: (dir) => TREE[dir.replace(/^\.\//, "") || "."] ?? [],
    statSync: (path) => ({
      isDirectory: () => Object.hasOwn(TREE, path.replace(/^\.\//, "")),
    }),
  };

  it(".sh だけを集める", () => {
    const found = collectShellFiles(".", fakeFs);
    expect(found).toContain("a.sh");
    expect(found).toContain("sub/c.sh");
    expect(found).not.toContain("b.txt");
  });

  it("node_modules には降りない（依存側の .sh を検査しない）", () => {
    const found = collectShellFiles(".", fakeFs);
    expect(found.some((p) => p.includes("node_modules"))).toBe(false);
  });
});
