// リリース連動文書が package.json とズレていないか検査する（ADR-0027）。
// さらに版番号そのものの妥当性も検査する（ADR-0031）:
//   (1) semver 形式（MAJOR.MINOR.PATCH）か（常時・リリース状態に依らず正当であるべき）
//   (2) 直近リリース（git タグ）より版が逆行していないか（毎 PR 安全: < で失敗・==/> は許可）
// CI 必須チェックに組み込み、リリース PR で文書更新漏れ・版番号ミスを構造的に防ぐ。
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { argv } from "node:process";
import { fileURLToPath } from "node:url";

// semver 形式（prerelease は現状未使用。将来使うならここを拡張する・ADR-0031）。
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
// `vX.Y.Z` 形式のタグだけを baseline 候補にする（注釈・他形式タグは無視）。
const TAG_RE = /^v(\d+\.\d+\.\d+)$/;

export const isValidSemver = (v) => SEMVER_RE.test(v);

// `MAJOR.MINOR.PATCH` を数値配列へ。事前に isValidSemver を通す前提（自前比較・ADR-0031 案C）。
const parseSemver = (v) => v.split(".").map(Number);

// a<b → -1 / a==b → 0 / a>b → 1。
export const compareSemver = (a, b) => {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
};

// タグ名の一覧から baseline（最大版）を求める。該当が無ければ "0.0.0"（初回は素通り）。
export const maxTagVersion = (tags) => {
  const versions = tags
    .map((t) => t.trim().match(TAG_RE)?.[1])
    .filter((v) => v != null);
  return versions.reduce(
    (max, v) => (compareSemver(v, max) > 0 ? v : max),
    "0.0.0",
  );
};

// 純粋な検査本体（fs/git に触れず単体テスト可能・ADR-0031）。エラー文言の配列を返す。
export const checkRelease = ({
  version,
  changelog,
  readme,
  minNode,
  baseline,
}) => {
  const errors = [];

  // (1) semver 形式検証（常時・ADR-0031）。
  const versionOk = isValidSemver(version);
  if (!versionOk) {
    errors.push(
      `package.json の version "${version}" が semver 形式（MAJOR.MINOR.PATCH）ではありません。`,
    );
  }

  // CHANGELOG に現 version の節があるか（Keep a Changelog・ADR-0026）。
  if (!changelog.includes(`## [${version}]`)) {
    errors.push(
      `CHANGELOG.md に "## [${version}]" の節がありません（リリース時に追記してください）。`,
    );
  }

  // README の Node バッジが engines.node と一致するか（engines を上げたらバッジも、の漏れ防止）。
  if (minNode) {
    if (!readme.includes(`Node >= ${minNode}`)) {
      errors.push(
        `README の Node バッジ alt が "Node >= ${minNode}" と一致しません（engines.node: >=${minNode}）。`,
      );
    }
    if (!readme.includes(`node-%3E%3D${minNode}-`)) {
      errors.push(
        `README の Node バッジ URL が ">=${minNode}" と一致しません（engines.node: >=${minNode}）。`,
      );
    }
  }

  // (2) 単調増加検証（baseline ＝ 直近 git タグ・ADR-0031 案A/案C）。
  // 形式不正時は数値比較が無意味なので skip（(1) で既に報告済み）。
  // 判定は「< で失敗・==/> は許可」＝毎 PR 安全（通常 PR を落とさず逆行だけ弾く）。
  if (versionOk && compareSemver(version, baseline) < 0) {
    errors.push(
      `version "${version}" が直近リリース "${baseline}" より小さい（版の逆行）。baseline 以上にしてください。`,
    );
  }

  return errors;
};

// git タグ一覧を取得（impure）。git が無い等で失敗したら [] を返し baseline=0.0.0 で素通り（フェイルセーフ）。
const readTags = () => {
  try {
    return execSync("git tag --list", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
};

const main = () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const pkg = JSON.parse(read("package.json"));
  const minNode = String(pkg.engines?.node ?? "").match(/(\d+)/)?.[1];
  const baseline = maxTagVersion(readTags());

  const errors = checkRelease({
    version: pkg.version,
    changelog: read("CHANGELOG.md"),
    readme: read("README.md"),
    minNode,
    baseline,
  });

  if (errors.length > 0) {
    console.error("✖ リリース不変条件チェック失敗:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    `✓ リリース不変条件 OK（version=${pkg.version}, baseline=${baseline}）`,
  );
};

// 直接起動時のみ実行（テストから import しても副作用＝process.exit を起こさない）。
if (argv[1] === fileURLToPath(import.meta.url)) main();
