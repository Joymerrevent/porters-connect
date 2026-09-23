import { describe, expect, it } from "vitest";

import {
  detect,
  isNonCode,
  isVersionOnlyChange,
  judge,
} from "./detect-release-bookkeeping.mjs";

const pkg = (version, extra = {}) =>
  JSON.stringify({ name: "x", version, dependencies: { a: "1" }, ...extra });

const packages = (base, head) => (side) => (side === "base" ? base : head);

describe("isNonCode", () => {
  it("md と docs/ 配下はコードでない", () => {
    expect(isNonCode("CHANGELOG.md")).toBe(true);
    expect(isNonCode(".changeset/foo.md")).toBe(true);
    expect(isNonCode("docs/roadmap.md")).toBe(true);
    expect(isNonCode("docs/usage/api/.nojekyll")).toBe(true);
  });

  it("src・設定・lockfile・changeset の設定はコード扱い", () => {
    expect(isNonCode("src/client.ts")).toBe(false);
    expect(isNonCode("pnpm-lock.yaml")).toBe(false);
    expect(isNonCode(".changeset/config.json")).toBe(false);
    expect(isNonCode("package.json")).toBe(false);
  });
});

describe("isVersionOnlyChange", () => {
  it("version だけが違えば true", () => {
    expect(isVersionOnlyChange(pkg("0.21.0"), pkg("0.22.0"))).toBe(true);
  });

  it("依存が変われば false", () => {
    expect(
      isVersionOnlyChange(
        pkg("0.21.0"),
        pkg("0.22.0", { dependencies: { a: "2" } }),
      ),
    ).toBe(false);
  });

  it("読めない JSON は例外（呼び出し側で skip しない側に倒す）", () => {
    expect(() => isVersionOnlyChange("{", pkg("0.22.0"))).toThrow();
  });
});

describe("judge", () => {
  it("リリース PR の形（version・CHANGELOG・changeset の消費）は bookkeeping", () => {
    const result = judge(
      ["package.json", "CHANGELOG.md", ".changeset/foo.md"],
      packages(pkg("0.21.0"), pkg("0.22.0")),
    );
    expect(result.bookkeeping).toBe(true);
  });

  it("develop と同じツリーなら bookkeeping", () => {
    expect(judge([], packages("", "")).bookkeeping).toBe(true);
  });

  it("リリースブランチでコードを直したらフル run", () => {
    const result = judge(
      ["package.json", "CHANGELOG.md", "src/client.ts"],
      packages(pkg("0.21.0"), pkg("0.22.0")),
    );
    expect(result).toMatchObject({ bookkeeping: false });
    expect(result.reason).toContain("src/client.ts");
  });

  it("package.json の version 以外の変更はフル run", () => {
    const result = judge(
      ["package.json"],
      packages(pkg("0.21.0"), pkg("0.22.0", { scripts: { x: "y" } })),
    );
    expect(result.bookkeeping).toBe(false);
  });

  it("lockfile の変更はフル run", () => {
    expect(judge(["pnpm-lock.yaml"], packages("", "")).bookkeeping).toBe(false);
  });
});

describe("detect", () => {
  it("git の出力から判定する（base / head の package.json を読み分ける）", () => {
    const calls = [];
    const git = (args) => {
      calls.push(args.join(" "));
      if (args[0] === "diff") return "package.json\nCHANGELOG.md\n";
      return args[1] === "origin/develop:package.json"
        ? pkg("0.21.0")
        : pkg("0.22.0");
    };
    expect(detect("origin/develop", "HEAD", git).bookkeeping).toBe(true);
    expect(calls).toEqual([
      "diff --name-only origin/develop HEAD",
      "show origin/develop:package.json",
      "show HEAD:package.json",
    ]);
  });

  it("git が失敗したら skip しない（failed を立てる）", () => {
    const git = () => {
      throw new Error("fatal: bad revision 'origin/develop'");
    };
    const result = detect("origin/develop", "HEAD", git);
    expect(result).toMatchObject({ bookkeeping: false, failed: true });
    expect(result.reason).toContain("bad revision");
  });

  it("package.json が片側に無いとき（show が失敗）も skip しない", () => {
    const git = (args) => {
      if (args[0] === "diff") return "package.json\n";
      throw new Error("fatal: path 'package.json' does not exist");
    };
    expect(detect("a", "b", git)).toMatchObject({
      bookkeeping: false,
      failed: true,
    });
  });
});
