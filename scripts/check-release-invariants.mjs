// リリース連動文書が package.json とズレていないか検査する（ADR-0027）。
// さらに版番号そのものの妥当性も検査する（ADR-0031）:
//   (1) semver 形式（MAJOR.MINOR.PATCH）か（常時・リリース状態に依らず正当であるべき）
//   (2) 直近リリース（git タグ）より版が逆行していないか（< で失敗・==/> は許可）
//       — (2) は base=main の PR（リリース PR）でのみ検査（ADR-0032・back-merge ラグの誤検知回避）
// あわせて **CI の Node マトリクスが engines の下限を実際に走らせているか**も見る（RV-53）。
// CI 必須チェックに組み込み、リリース PR で文書更新漏れ・版番号ミスを構造的に防ぐ。
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { argv } from "node:process";
import { fileURLToPath } from "node:url";

// semver 形式（prerelease は現状未使用。将来使うならここを拡張する・ADR-0031）。
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
// `vX.Y.Z` 形式のタグだけを baseline 候補にする（注釈・他形式タグは無視）。
const TAG_RE = /^v(\d+\.\d+\.\d+)$/;
// `engines.node` は `>=X[.Y[.Z]]` の形だけを受け付ける。ADR-0082 で下限を `>=22.12.0` に
// 上げたが、**丸めた `>=22` は 22.0〜22.11 に対して嘘になる**（`require(esm)` が無い）。
// だからバッジ側も丸めずに突き合わせる＝ここは major だけを採らない。
const MIN_NODE_RE = /^>=(\d+(?:\.\d+){0,2})$/;

// `engines.node` から下限の版を採る。読めなければ undefined（呼び出し側でエラーにする）。
export const minNodeOf = (enginesNode) =>
  MIN_NODE_RE.exec(String(enginesNode ?? "").trim())?.[1];

/**
 * CI の Node マトリクスが `floor`（engines の下限）を**そのまま**含むか（RV-53）。
 *
 * `node: ["22.12", 22, 24, 26]` の行から要素を読み、クォートを外して突き合わせる。
 * `22` は `22.12` を**含まない**と判定するのが要点 — メジャー指定はその系の最新に解決され、
 * 下限そのものは走らないため。マトリクス行が読めなければ「無い」扱い（fail-safe: 検査の
 * 空振りより、読めないことを報告して人に見てもらうほうがよい）。
 */
export const matrixCoversFloor = (workflow, floor) => {
  const row = /^\s*node:\s*\[(.+)\]\s*$/m.exec(String(workflow ?? ""));
  if (!row) return false;
  const versions = row[1]
    .split(",")
    .map((v) => v.trim().replace(/^["']|["']$/g, ""));
  return versions.includes(floor);
};

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
  enginesNode,
  testWorkflow,
  baseline,
  releaseContext,
}) => {
  const errors = [];
  const minNode = minNodeOf(enginesNode);

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
  // 読めない `engines.node` は **skip せずエラー**にする。黙って飛ばすと「検査したつもりで
  // 一度も走っていない」状態＝バッジのドリフトを永久に見逃す（fail-open）。
  if (minNode == null) {
    errors.push(
      `package.json の engines.node "${String(enginesNode)}" が \`>=X.Y.Z\` の形ではありません（README バッジと突き合わせられません）。`,
    );
  } else {
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
    // CI のマトリクスが下限そのものを走らせているか（RV-53）。`22` のようなメジャー指定は
    // **その時点の 22 系最新**に解決されるので、`engines` が約束した `22.12` は一度も
    // 走らない。22.12 より後に入った API を使った日に、CI は緑のまま下限の利用者だけが
    // 実行時に落ちる。**約束した版を走らせて初めて約束になる。**
    //
    // バッジと同じ「宣言 ↔ 実体」の検査だが、こちらは**約束が守られているか**を見る点が違う。
    // engines を上げたらマトリクスも上げる必要があり、それを忘れると下限が未検査に戻る。
    if (!matrixCoversFloor(testWorkflow, minNode)) {
      errors.push(
        `CI の Node マトリクスに engines の下限 "${minNode}" がありません` +
          `（.github/workflows/test.yml）。メジャーだけの指定はその系の最新に解決されるので、` +
          `下限そのものは走りません。\`"${minNode}"\` を足してください。`,
      );
    }
  }

  // (2) 単調増加検証（baseline ＝ 直近 git タグ・ADR-0031 案A/案C）。
  // base=main の PR（リリース PR）でのみ検査する（ADR-0032）。git-flow の手動 back-merge
  // ラグで develop の version が最新タグを下回る窓があり、毎 PR で回すと無関係 PR を誤検知するため。
  // 版の逆行が実害になるのは publish の瞬間＝必ず main 向け PR を通るので、そこで弾けば十分。
  // 形式不正時は数値比較が無意味なので skip（(1) で既に報告済み）。判定は「< で失敗・==/> は許可」。
  if (releaseContext && versionOk && compareSemver(version, baseline) < 0) {
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
  const baseline = maxTagVersion(readTags());
  // base=main の PR でのみ単調増加(2)を検査する（ADR-0032）。GitHub Actions の
  // pull_request では GITHUB_BASE_REF にマージ先ブランチ名が入る。push/local では空。
  const releaseContext = process.env.GITHUB_BASE_REF === "main";

  const errors = checkRelease({
    version: pkg.version,
    changelog: read("CHANGELOG.md"),
    readme: read("README.md"),
    enginesNode: pkg.engines?.node,
    testWorkflow: read(".github/workflows/test.yml"),
    baseline,
    releaseContext,
  });

  if (errors.length > 0) {
    console.error("✖ リリース不変条件チェック失敗:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const monotonicNote = releaseContext
    ? ""
    : "・単調増加は base=main の PR でのみ検査";
  console.log(
    `✓ リリース不変条件 OK（version=${pkg.version}, baseline=${baseline}${monotonicNote}）`,
  );
};

// 直接起動時のみ実行（テストから import しても副作用＝process.exit を起こさない）。
if (argv[1] === fileURLToPath(import.meta.url)) main();
