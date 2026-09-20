import { describe, expect, it } from "vitest";

import {
  checkRelease,
  compareSemver,
  isValidSemver,
  matrixCoversFloor,
  maxTagVersion,
  minNodeOf,
} from "./check-release-invariants.mjs";

// 文書が整合し版番号も正当な「全部 OK」の入力（各テストで一部だけ崩す）。
// releaseContext: true ＝ base=main の PR（単調増加(2)を検査する文脈・ADR-0032）。
const ok = {
  version: "0.2.0",
  changelog: "## [0.2.0]\n- something",
  readme: "Node >= 22.12.0 ... node-%3E%3D22.12.0-brightgreen",
  enginesNode: ">=22.12.0",
  testWorkflow: '        node: ["22.12.0", 22, 24, 26]\n',
  baseline: "0.2.0",
  releaseContext: true,
};

describe("isValidSemver (ADR-0031)", () => {
  it("accepts MAJOR.MINOR.PATCH", () => {
    expect(isValidSemver("0.0.0")).toBe(true);
    expect(isValidSemver("1.2.3")).toBe(true);
    expect(isValidSemver("10.20.30")).toBe(true);
  });

  it("rejects malformed versions", () => {
    expect(isValidSemver("0.30")).toBe(false); // patch 欠落
    expect(isValidSemver("0.3")).toBe(false);
    expect(isValidSemver("v0.3.0")).toBe(false); // 接頭辞 v
    expect(isValidSemver("0.3.0 ")).toBe(false); // 末尾空白
    expect(isValidSemver("0.3.0-rc.1")).toBe(false); // prerelease は現状未対応
    expect(isValidSemver("")).toBe(false);
  });
});

describe("compareSemver (ADR-0031)", () => {
  it("orders by major, minor, patch", () => {
    expect(compareSemver("0.1.0", "0.2.0")).toBe(-1);
    expect(compareSemver("0.2.0", "0.2.0")).toBe(0);
    expect(compareSemver("0.2.1", "0.2.0")).toBe(1);
    expect(compareSemver("1.0.0", "0.9.9")).toBe(1);
    expect(compareSemver("0.10.0", "0.9.0")).toBe(1); // 数値比較（文字列順ではない）
  });
});

describe("maxTagVersion (ADR-0031)", () => {
  it("returns the highest vX.Y.Z tag", () => {
    expect(maxTagVersion(["v0.1.0", "v0.2.0", "v0.1.1"])).toBe("0.2.0");
    expect(maxTagVersion(["v0.9.0", "v0.10.0"])).toBe("0.10.0");
  });

  it("ignores non-version tags and trims whitespace", () => {
    expect(maxTagVersion([" v0.2.0 ", "latest", "v1", "release-1"])).toBe(
      "0.2.0",
    );
  });

  it("falls back to 0.0.0 when there is no tag (初回 publish 前)", () => {
    expect(maxTagVersion([])).toBe("0.0.0");
    expect(maxTagVersion(["nightly", "latest"])).toBe("0.0.0");
  });
});

describe("minNodeOf (ADR-0082)", () => {
  it("keeps the minimum as written (丸めない)", () => {
    expect(minNodeOf(">=22.12.0")).toBe("22.12.0");
    expect(minNodeOf(">=22")).toBe("22");
    expect(minNodeOf(" >=20.19.0 ")).toBe("20.19.0");
  });

  it("returns undefined for ranges it cannot read", () => {
    // 読めない形は undefined → checkRelease 側でエラーにする（skip しない）。
    expect(minNodeOf("^22.12.0")).toBeUndefined();
    expect(minNodeOf(">=22.12.0 <25")).toBeUndefined();
    expect(minNodeOf("")).toBeUndefined();
    expect(minNodeOf(undefined)).toBeUndefined();
  });
});

describe("checkRelease (ADR-0027 + ADR-0031)", () => {
  it("passes when docs match and version is valid & not regressing", () => {
    expect(checkRelease(ok)).toEqual([]);
    // version == baseline（通常 PR・据え置き）も許可。
    expect(
      checkRelease({ ...ok, version: "0.2.0", baseline: "0.2.0" }),
    ).toEqual([]);
    // version > baseline（リリース PR）も許可。
    expect(
      checkRelease({
        ...ok,
        version: "0.3.0",
        changelog: "## [0.3.0]",
        baseline: "0.2.0",
      }),
    ).toEqual([]);
  });

  it("flags a malformed semver version", () => {
    const errors = checkRelease({ ...ok, version: "0.30" });
    expect(errors.some((e) => e.includes("semver 形式"))).toBe(true);
  });

  it("does not run the monotonic check when the version is malformed", () => {
    // "0.30" は形式不正。逆行メッセージは出さない（形式エラーのみ）。
    const errors = checkRelease({ ...ok, version: "0.30", baseline: "9.9.9" });
    expect(errors.some((e) => e.includes("版の逆行"))).toBe(false);
  });

  it("flags a regressing version on a release PR (base=main)", () => {
    const errors = checkRelease({
      ...ok,
      version: "0.1.5",
      changelog: "## [0.1.5]",
      baseline: "0.2.0",
      releaseContext: true,
    });
    expect(errors.some((e) => e.includes("版の逆行"))).toBe(true);
  });

  it("skips the monotonic check outside a release PR (ADR-0032)", () => {
    // develop の通常 PR（base!=main）。back-merge ラグで version<baseline でも誤検知しない。
    expect(
      checkRelease({
        ...ok,
        version: "0.1.5",
        changelog: "## [0.1.5]",
        baseline: "0.2.0",
        releaseContext: false,
      }),
    ).toEqual([]);
  });

  it("flags a missing CHANGELOG section", () => {
    const errors = checkRelease({ ...ok, changelog: "## [0.1.0]" });
    expect(errors.some((e) => e.includes("CHANGELOG.md"))).toBe(true);
  });

  it("flags Node badge drift (alt and URL)", () => {
    const errors = checkRelease({ ...ok, readme: "no badge here" });
    expect(errors.some((e) => e.includes("Node バッジ alt"))).toBe(true);
    expect(errors.some((e) => e.includes("Node バッジ URL"))).toBe(true);
  });

  it("flags a badge that rounds the minimum (ADR-0082)", () => {
    // engines が ">=22.12.0" なのにバッジが ">=22" ＝ 22.0〜22.11 に対して嘘になる。
    const errors = checkRelease({
      ...ok,
      readme: "Node >= 22 ... node-%3E%3D22-brightgreen",
    });
    expect(errors.some((e) => e.includes("Node バッジ URL"))).toBe(true);
  });

  it("flags an engines.node it cannot read instead of skipping (fail-safe)", () => {
    const errors = checkRelease({ ...ok, enginesNode: "^22.12.0" });
    expect(errors.some((e) => e.includes("engines.node"))).toBe(true);
  });
});

// RV-53。`engines` が約束した下限を CI が一度も走らせていなかった。約束と実体のずれは
// engines を上げるたびに再発しうるので、検査で止める。
describe("matrixCoversFloor (RV-53)", () => {
  const row = (versions) => `        node: [${versions}]\n`;

  it("下限がそのまま入っていれば通す", () => {
    expect(matrixCoversFloor(row('"22.12.0", 22, 24, 26'), "22.12.0")).toBe(
      true,
    );
  });

  it("**メジャーだけの指定は下限を含まない**（この検査の要点）", () => {
    // `22` はその系の最新に解決されるので、22.12.0 そのものは走らない。
    expect(matrixCoversFloor(row("22, 24, 26"), "22.12.0")).toBe(false);
  });

  it("マイナーまででも、下限の表記と違えば通さない", () => {
    // 文字列で突き合わせる＝どちらの表記を使うかを 1 つに決める（エラー文が正解を示す）。
    expect(matrixCoversFloor(row('"22.12", 24'), "22.12.0")).toBe(false);
  });

  it("クォートの有無は問わない", () => {
    expect(matrixCoversFloor(row("'22.12.0', 24"), "22.12.0")).toBe(true);
    expect(matrixCoversFloor(row("22.12.0, 24"), "22.12.0")).toBe(true);
  });

  it("マトリクス行が読めなければ「無い」扱い（fail-safe）", () => {
    // 検査の空振りより、読めないことを報告して人に見てもらうほうがよい。
    expect(matrixCoversFloor("name: Test\n", "22.12.0")).toBe(false);
    expect(matrixCoversFloor("", "22.12.0")).toBe(false);
    expect(matrixCoversFloor(undefined, "22.12.0")).toBe(false);
  });
});

describe("checkRelease: CI マトリクスと engines の下限 (RV-53)", () => {
  it("下限が入っていなければ落とす", () => {
    const errors = checkRelease({
      ...ok,
      testWorkflow: "        node: [22, 24, 26]\n",
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("22.12.0");
    expect(errors[0]).toContain("test.yml");
  });

  it("engines を上げてマトリクスを直し忘れたら落ちる（このズレが再発の形）", () => {
    const errors = checkRelease({
      ...ok,
      enginesNode: ">=24.0.0",
      readme: "Node >= 24.0.0 ... node-%3E%3D24.0.0-brightgreen",
      // マトリクスは 22.12.0 のまま＝新しい下限は未検査
      testWorkflow: '        node: ["22.12.0", 22, 24, 26]\n',
    });
    expect(errors.some((e) => e.includes("24.0.0"))).toBe(true);
  });

  it("engines が読めないときはマトリクスを見ない（先に engines を報告する）", () => {
    const errors = checkRelease({
      ...ok,
      enginesNode: "^22",
      testWorkflow: "        node: [22]\n",
    });
    // 「engines が読めない」の 1 件だけ。下限が不明なまま突き合わせても意味が無い。
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("engines.node");
  });
});
