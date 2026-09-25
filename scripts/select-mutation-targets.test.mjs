import { describe, expect, it } from "vitest";

import {
  detect,
  globToRegExp,
  inMutate,
  select,
} from "./select-mutation-targets.mjs";

// stryker.config.json の mutate と同じ形（ADR-0094 の判定はこのパターンを読んで使う）
const PATTERNS = [
  "src/**/*.ts",
  "!src/**/*.test.ts",
  "!src/**/index.ts",
  "!src/**/types.ts",
  "!src/types/**",
];

const pkg = (version, extra = {}) =>
  JSON.stringify({ name: "x", version, dependencies: { a: "1" }, ...extra });
const packages = (base, head) => (side) => (side === "base" ? base : head);
const sameVersion = packages(pkg("0.1.0"), pkg("0.1.0"));

// head にある実装（隣のテストから引いたものが実在するかの判定に使う）
const EXISTING = new Set([
  "src/util/datetime.ts",
  "src/util/new.ts",
  "src/auth/auth-api.ts",
]);

const run = (changes, readPackage = sameVersion) =>
  select(
    changes.map((c) => (typeof c === "string" ? { status: "M", path: c } : c)),
    { patterns: PATTERNS, readPackage, exists: (path) => EXISTING.has(path) },
  );

describe("globToRegExp", () => {
  it("`**/` は途中のディレクトリ 0 個以上、`*` は `/` をまたがない", () => {
    const re = globToRegExp("src/**/*.ts");
    expect(re.test("src/client.ts")).toBe(true);
    expect(re.test("src/auth/token-manager.ts")).toBe(true);
    expect(re.test("src/auth/token-manager.tsx")).toBe(false);
    expect(re.test("test/src/client.ts")).toBe(false);
    expect(globToRegExp("src/*.ts").test("src/auth/a.ts")).toBe(false);
  });

  it("末尾の `**` は残り全部、`.` は文字どおり", () => {
    expect(globToRegExp("src/types/**").test("src/types/scope.ts")).toBe(true);
    expect(globToRegExp("src/types/**").test("src/typesx/a.ts")).toBe(false);
    expect(globToRegExp("a.ts").test("abts")).toBe(false);
  });
});

describe("inMutate", () => {
  it("mutate に入る実装だけ true（テスト・index・types・src/types は外れる）", () => {
    expect(inMutate(PATTERNS, "src/client.ts")).toBe(true);
    expect(inMutate(PATTERNS, "src/auth/token-manager.ts")).toBe(true);
    expect(inMutate(PATTERNS, "src/client.test.ts")).toBe(false);
    expect(inMutate(PATTERNS, "src/auth/index.ts")).toBe(false);
    expect(inMutate(PATTERNS, "src/auth/types.ts")).toBe(false);
    expect(inMutate(PATTERNS, "src/types/scope.ts")).toBe(false);
    expect(inMutate(PATTERNS, "scripts/check.mjs")).toBe(false);
  });
});

describe("select", () => {
  it("実装を変えたらそのファイルだけ", () => {
    expect(run(["src/util/datetime.ts"])).toMatchObject({
      mode: "subset",
      targets: ["src/util/datetime.ts"],
    });
  });

  it("隣のテストだけを変えたら、その実装を対象にする（重複はまとめ、並べて返す）", () => {
    expect(
      run([
        "src/util/datetime.test.ts",
        "src/util/datetime.ts",
        "src/auth/auth-api.test.ts",
      ]),
    ).toMatchObject({
      mode: "subset",
      targets: ["src/auth/auth-api.ts", "src/util/datetime.ts"],
    });
  });

  it("新しく足した実装も対象にする", () => {
    expect(run([{ status: "A", path: "src/util/new.ts" }])).toMatchObject({
      mode: "subset",
      targets: ["src/util/new.ts"],
    });
  });

  it("文書・scripts・.github・version だけなら skip", () => {
    expect(
      run(
        [
          "README.md",
          "docs/usage/index.md",
          ".changeset/foo.md",
          "scripts/check-doc-examples.mjs",
          ".github/workflows/mutation.yml",
          "package.json",
        ],
        packages(pkg("0.24.0"), pkg("0.25.0")),
      ),
    ).toMatchObject({ mode: "skip" });
  });

  it("back-merge の形（version・CHANGELOG・changeset の消費）は skip", () => {
    expect(
      run(
        [
          "package.json",
          "CHANGELOG.md",
          { status: "D", path: ".changeset/foo.md" },
        ],
        packages(pkg("0.24.0"), pkg("0.25.0")),
      ),
    ).toMatchObject({ mode: "skip" });
  });

  it("差分が無ければ skip", () => {
    expect(run([])).toMatchObject({ mode: "skip" });
  });

  it.each([
    ["mutate の外の src（index.ts）", "src/auth/index.ts"],
    ["mutate の外の src（types.ts）", "src/auth/types.ts"],
    ["mutate の外の src（src/types/）", "src/types/scope.ts"],
    ["隣に実装の無いテスト", "src/auth/helpers.test.ts"],
    ["src の ts でないもの", "src/fixtures/a.json"],
    ["結合テスト", "test/integration/candidate.test.ts"],
    ["フィクスチャ", "test/fixtures/candidate/read-basic.xml"],
    ["lockfile", "pnpm-lock.yaml"],
    ["stryker の設定", "stryker.config.json"],
    ["vitest の設定", "vitest.config.ts"],
    ["tsconfig", "tsconfig.json"],
    ["changeset の設定", ".changeset/config.json"],
  ])("%s を変えたらフル run（%s）", (_label, path) => {
    const result = run(["src/util/datetime.ts", path]);
    expect(result.mode).toBe("full");
    expect(result.reason).toContain(path);
  });

  it("src の実装を消したらフル run（消したファイルは検査できず、使っていた側への影響が読めない）", () => {
    expect(run([{ status: "D", path: "src/util/old.ts" }])).toMatchObject({
      mode: "full",
    });
  });

  it("package.json の依存を変えたらフル run", () => {
    expect(
      run(
        ["package.json"],
        packages(pkg("0.24.0"), pkg("0.24.0", { dependencies: { a: "2" } })),
      ),
    ).toMatchObject({
      mode: "full",
      reason: "package.json に version 以外の変更がある",
    });
  });

  it("package.json が読めなければ例外（detect がフル run に倒す）", () => {
    expect(() => run(["package.json"], packages("{", pkg("0.1.0")))).toThrow();
  });
});

describe("detect", () => {
  const config = () => JSON.stringify({ mutate: PATTERNS });

  it("git の --name-status を読んで判定し、隣の実装の有無は head で確かめる", () => {
    const calls = [];
    const git = (args) => {
      calls.push(args);
      if (args[0] === "cat-file") {
        if (args[2] === "HEAD:src/util/new.ts") return "";
        throw new Error("missing");
      }
      return "M\tsrc/util/datetime.ts\nA\tsrc/util/new.test.ts\n";
    };
    const result = detect("origin/develop", "HEAD", git, config);
    expect(calls[0]).toEqual([
      "diff",
      "--name-status",
      "--no-renames",
      "origin/develop",
      "HEAD",
    ]);
    expect(result).toMatchObject({
      mode: "subset",
      targets: ["src/util/datetime.ts", "src/util/new.ts"],
    });
    expect(calls).toContainEqual(["cat-file", "-e", "HEAD:src/util/new.ts"]);
  });

  it("隣の実装が head に無いテストはフル run", () => {
    const git = (args) => {
      if (args[0] === "cat-file") throw new Error("missing");
      return "A\tsrc/util/helpers.test.ts\n";
    };
    expect(detect("b", "HEAD", git, config)).toMatchObject({ mode: "full" });
  });

  it("package.json は base と head の両方を git show で読む", () => {
    const shown = [];
    const git = (args) => {
      if (args[0] === "show") {
        shown.push(args[1]);
        return args[1].startsWith("origin/develop")
          ? pkg("0.24.0")
          : pkg("0.25.0");
      }
      return "M\tpackage.json\n";
    };
    expect(detect("origin/develop", "HEAD", git, config)).toMatchObject({
      mode: "skip",
    });
    expect(shown.sort()).toEqual([
      "HEAD:package.json",
      "origin/develop:package.json",
    ]);
  });

  it("git が失敗したらフル run（1 行の理由つき）", () => {
    const git = () => {
      throw new Error("fatal: bad revision\n'origin/develop'");
    };
    expect(detect("origin/develop", "HEAD", git, config)).toEqual({
      mode: "full",
      reason:
        "判定できなかったのでフル run にする: fatal: bad revision 'origin/develop'",
      failed: true,
    });
  });

  it("stryker.config.json に mutate が無い・読めなければフル run", () => {
    const git = () => "M\tsrc/util/datetime.ts\n";
    expect(detect("b", "h", git, () => "{}")).toMatchObject({
      mode: "full",
      failed: true,
    });
    expect(
      detect("b", "h", git, () => JSON.stringify({ mutate: [] })),
    ).toMatchObject({
      mode: "full",
      failed: true,
    });
    expect(detect("b", "h", git, () => "{")).toMatchObject({
      mode: "full",
      failed: true,
    });
  });

  it("例外でない値が投げられても文字列にして理由に入れる", () => {
    const git = () => {
      throw "boom";
    };
    expect(detect("b", "h", git, config).reason).toBe(
      "判定できなかったのでフル run にする: boom",
    );
  });
});
