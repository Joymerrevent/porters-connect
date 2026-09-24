import { describe, expect, it } from "vitest";

import {
  checkAdrImplemented,
  checkRelease,
  compareSemver,
  firstMentionedVersions,
  isValidSemver,
  matrixCoversFloor,
  maxTagVersion,
  minNodeOf,
  parseAdrIndex,
  checkTypeScriptFloor,
} from "./check-release-invariants.mjs";

// 文書が整合し版番号も正当な「全部 OK」の入力（各テストで一部だけ崩す）。
// releaseContext: true ＝ base=main の PR（単調増加(2)を検査する文脈・ADR-0032）。
// ADR 索引の最小形（ヘッダ ＋ 区切り ＋ 行）。`adrRow` で 1 行ずつ組む。
const adrRow = (id, phase, implemented, status = "accepted") =>
  `| [${id}][${id}] | title ${id} | ${phase} | ${status} | ${implemented} |`;
const adrIndexOf = (...rows) =>
  [
    "| #            | タイトル | フェーズ | ステータス | 実装 |",
    "| ------------ | -------- | -------- | ---------- | ---- |",
    ...rows,
  ].join("\n");

const ok = {
  version: "0.2.0",
  changelog: "## [0.2.0]\n- something",
  readme: "Node >= 22.12.0 ... node-%3E%3D22.12.0-brightgreen",
  enginesNode: ">=22.12.0",
  testWorkflow: '        node: ["22.12.0", 22, 24, 26]\n',
  adrIndex: adrIndexOf(adrRow("0001", "プロセス", "—")),
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

// RV-56。索引の「実装」列は任意項目で、check:index は「食い違い」しか見ない（両方空なら通る）。
// その結果 0.8.0 以降の設計 ADR 21 本が 1 本も持っていなかった。CHANGELOG を出典に
// 「あるべき値」を導いて突き合わせる。
describe("firstMentionedVersions (RV-56)", () => {
  it("版節ごとの ADR-NNNN の名指しを集め、最初に名指しした版を返す", () => {
    const changelog = [
      "## [Unreleased]",
      "- 次で [ADR-0099][adr99] を実施予定",
      "## [0.18.0] - 2026-09-17",
      "- バケットが宛先ごとに（[ADR-0073][adr73]・RV-43）",
      "## [0.15.0] - 2026-09-13",
      "- スロットルを差し替えられる（[ADR-0073][adr73]）",
      "- 突合の 4 API（ADR-0069）",
      "[adr73]: docs/adr/0073-throttle-sharing.md",
    ].join("\n");
    const first = firstMentionedVersions(changelog);
    expect(first.get("0073")).toBe("0.15.0"); // 0.18.0 でも挙がるが最初の版
    expect(first.get("0069")).toBe("0.15.0"); // リンクでない素の表記も拾う
    expect(first.get("0099")).toBeUndefined(); // [Unreleased] は版ではない
  });

  it("節に属さない前書きと、版でない節は数えない", () => {
    const changelog = [
      "# Changelog",
      "本書は ADR-0026 の方針で手書きしている。",
      "## [Unreleased]",
      "- ADR-0090",
      "## [0.1.0] - 2026-06-19",
      "- ADR-0023",
    ].join("\n");
    const first = firstMentionedVersions(changelog);
    expect([...first.keys()]).toEqual(["0023"]);
  });

  it("空・未定義でも落ちない（空の Map）", () => {
    expect(firstMentionedVersions("").size).toBe(0);
    expect(firstMentionedVersions(undefined).size).toBe(0);
  });
});

describe("parseAdrIndex (RV-56)", () => {
  it("ヘッダの見出しで列を探す（並びが変わっても壊れない）", () => {
    const reordered = [
      "| # | 実装 | タイトル | フェーズ | ステータス |",
      "| - | ---- | -------- | -------- | ---------- |",
      "| [0055][0055] | 0.10.0 | t | 基本設計 | accepted |",
    ].join("\n");
    expect(parseAdrIndex(reordered)).toEqual([
      { id: "0055", phase: "基本設計", implemented: "0.10.0" },
    ]);
  });

  it("フェーズ / 実装 の列が無ければ undefined（読めないことを報告する）", () => {
    expect(
      parseAdrIndex("| # | タイトル |\n| - | - |\n| [0001][0001] | t |"),
    ).toBeUndefined();
    expect(parseAdrIndex("")).toBeUndefined();
    expect(parseAdrIndex(undefined)).toBeUndefined();
  });
});

describe("checkAdrImplemented (RV-56)", () => {
  const changelog = [
    "## [Unreleased]",
    "- ADR-0090 は次で",
    "## [0.18.0] - 2026-09-17",
    "- [ADR-0073][adr73]（宛先ごと）／[ADR-0078][adr78]",
    "## [0.15.0] - 2026-09-13",
    "- [ADR-0073][adr73]／[ADR-0069][adr69]／[ADR-0068][adr68]",
    "## [0.9.0] - 2026-08-20",
    "- カタログが真実源（[ADR-0019][adr19]）／既定 field（ADR-0020）",
  ].join("\n");

  it("名指しされた設計 ADR に最初の版が入っていれば通す", () => {
    const adrIndex = adrIndexOf(
      adrRow("0069", "詳細設計", "0.15.0"),
      adrRow("0073", "詳細設計", "0.15.0"),
      adrRow("0078", "基本設計", "0.18.0"),
    );
    expect(checkAdrImplemented({ changelog, adrIndex })).toEqual([]);
  });

  it("**名指しされているのに空なら落とす**（この検査の本体・0055〜0086 の 21 本がこの形だった）", () => {
    const adrIndex = adrIndexOf(adrRow("0078", "基本設計", "—"));
    const errors = checkAdrImplemented({ changelog, adrIndex });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("ADR-0078");
    expect(errors[0]).toContain("0.18.0");
    expect(errors[0]).toContain("- Implemented: 0.18.0");
  });

  it("最初の版でなく後の版を書いていたら落とす（改訂の文脈で挙がった版は「世に出た版」ではない）", () => {
    const adrIndex = adrIndexOf(adrRow("0073", "詳細設計", "0.18.0"));
    const errors = checkAdrImplemented({ changelog, adrIndex });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("0.15.0");
  });

  it("CHANGELOG が名指ししていない版を書いていたら落とす（記入は CHANGELOG が版を明示している分に限る）", () => {
    const adrIndex = adrIndexOf(adrRow("0083", "詳細設計", "0.18.0"));
    const errors = checkAdrImplemented({ changelog, adrIndex });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("ADR-0083");
    expect(errors[0]).toContain("名指ししていません");
  });

  it("[Unreleased] の名指しは版ではないので、空のままで通す", () => {
    const adrIndex = adrIndexOf(adrRow("0090", "詳細設計", "—"));
    expect(checkAdrImplemented({ changelog, adrIndex })).toEqual([]);
  });

  it("0053 以前は見ない（MVP 期の決定は「空欄のまま」と ADR-0053 で決めた）", () => {
    // 0019 / 0020 は 0.9.0 の CHANGELOG が文脈として挙げるだけで、実装は 0.1.0 以前。
    const adrIndex = adrIndexOf(
      adrRow("0019", "詳細設計", "—"),
      adrRow("0020", "詳細設計", "—"),
      adrRow("0053", "プロセス", "—"),
    );
    expect(checkAdrImplemented({ changelog, adrIndex })).toEqual([]);
  });

  it("設計フェーズ以外（プロセス / 要件定義）は見ない", () => {
    // 0068 はプロセス決定で「実装の概念が無い」側。名指しされていても空でよい。
    const adrIndex = adrIndexOf(
      adrRow("0068", "プロセス", "—"),
      adrRow("0060", "要件定義", "—"),
    );
    expect(checkAdrImplemented({ changelog, adrIndex })).toEqual([]);
  });

  it("索引が読めなければ 1 件のエラー（黙って通さない）", () => {
    expect(checkAdrImplemented({ changelog, adrIndex: "" })).toHaveLength(1);
    expect(
      checkAdrImplemented({ changelog, adrIndex: undefined }),
    ).toHaveLength(1);
    // ヘッダはあるが行が 0 本＝索引が空。これも「検査が一度も走らない」形なので落とす。
    expect(
      checkAdrImplemented({ changelog, adrIndex: adrIndexOf() }),
    ).toHaveLength(1);
  });
});

describe("checkRelease: CHANGELOG が名指しした設計 ADR の「実装」(RV-56)", () => {
  it("リリース PR で [Unreleased] が版節になった瞬間に、記入漏れが落ちる", () => {
    const before = {
      ...ok,
      version: "0.2.0",
      changelog: "## [Unreleased]\n- [ADR-0090][adr90]\n## [0.2.0]\n- x",
      adrIndex: adrIndexOf(adrRow("0090", "詳細設計", "—")),
    };
    expect(checkRelease(before)).toEqual([]);
    const released = {
      ...before,
      version: "0.3.0",
      changelog:
        "## [Unreleased]\n## [0.3.0]\n- [ADR-0090][adr90]\n## [0.2.0]\n- x",
    };
    const errors = checkRelease(released);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("ADR-0090");
    expect(errors[0]).toContain("0.3.0");
  });
});

describe("checkTypeScriptFloor (ADR-0090)", () => {
  const pkg = {
    exports: {
      ".": {
        import: { "types@<5.4": "./dist/old.d.ts", types: "./dist/index.d.ts" },
        require: {
          "types@<5.4": "./dist/old.d.cts",
          types: "./dist/index.d.cts",
        },
      },
    },
    typesVersions: { "<5.4": { "*": ["dist/old.d.ts"] } },
  };
  const readme = "型を読むには **TypeScript 5.4 以上**が要ります";
  const install = "TypeScript で使うなら **5.4 以上**にしてください。";

  it("accepts one floor everywhere", () => {
    expect(checkTypeScriptFloor({ pkg, readme, install })).toEqual([]);
  });

  it("reports a document naming another version", () => {
    expect(
      checkTypeScriptFloor({
        pkg,
        readme: readme.replace("5.4", "5.5"),
        install,
      }),
    ).toEqual([
      "README.md の「TypeScript 5.5 以上」が、exports の下限 5.4 と違います。",
    ]);
  });

  it("reports a document that does not state the floor at all", () => {
    expect(
      checkTypeScriptFloor({ pkg, readme, install: "何も書いていない" }),
    ).toEqual([
      "docs/usage/start/install.md に「TypeScript 5.4 以上」がありません。",
    ]);
  });

  it("reports typesVersions that disagrees with exports", () => {
    const errors = checkTypeScriptFloor({
      pkg: { ...pkg, typesVersions: { "<5.3": { "*": ["x"] } } },
      readme,
      install,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(
      'typesVersions が "<5.4" の 1 つだけになっていません',
    );
  });

  it("reports an unreadable floor instead of skipping the check", () => {
    expect(checkTypeScriptFloor({ pkg: {}, readme, install })[0]).toContain(
      "TypeScript の下限を package.json から読めません",
    );
  });
});
