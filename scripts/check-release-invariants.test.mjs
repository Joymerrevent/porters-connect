import { describe, expect, it } from "vitest";

import {
  checkRelease,
  compareSemver,
  isValidSemver,
  maxTagVersion,
} from "./check-release-invariants.mjs";

// 文書が整合し版番号も正当な「全部 OK」の入力（各テストで一部だけ崩す）。
const ok = {
  version: "0.2.0",
  changelog: "## [0.2.0]\n- something",
  readme: "Node >= 20 ... node-%3E%3D20-brightgreen",
  minNode: "20",
  baseline: "0.2.0",
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

  it("flags a regressing version (< baseline)", () => {
    const errors = checkRelease({
      ...ok,
      version: "0.1.5",
      changelog: "## [0.1.5]",
      baseline: "0.2.0",
    });
    expect(errors.some((e) => e.includes("版の逆行"))).toBe(true);
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

  it("skips the Node badge check when minNode is absent", () => {
    expect(
      checkRelease({ ...ok, minNode: undefined, readme: "no badge" }),
    ).toEqual([]);
  });
});
