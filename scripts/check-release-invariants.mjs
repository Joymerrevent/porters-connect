// リリース連動文書が package.json とズレていないか検査する（ADR-0027）。
// CI 必須チェックに組み込み、リリース PR で文書更新漏れを構造的に防ぐ。
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const pkg = JSON.parse(read("package.json"));
const version = pkg.version;
const errors = [];

// 1) CHANGELOG に現 version の節があるか（Keep a Changelog・ADR-0026）。
const changelog = read("CHANGELOG.md");
if (!changelog.includes(`## [${version}]`)) {
  errors.push(
    `CHANGELOG.md に "## [${version}]" の節がありません（リリース時に追記してください）。`,
  );
}

// 2) README の Node バッジが engines.node と一致するか（engines を上げたらバッジも、の漏れ防止）。
const minNode = String(pkg.engines?.node ?? "").match(/(\d+)/)?.[1];
if (minNode) {
  const readme = read("README.md");
  if (!readme.includes(`Node >= ${minNode}`)) {
    errors.push(
      `README の Node バッジ alt が "Node >= ${minNode}" と一致しません（engines.node: ${pkg.engines.node}）。`,
    );
  }
  if (!readme.includes(`node-%3E%3D${minNode}-`)) {
    errors.push(
      `README の Node バッジ URL が ">=${minNode}" と一致しません（engines.node: ${pkg.engines.node}）。`,
    );
  }
}

if (errors.length > 0) {
  console.error("✖ リリース不変条件チェック失敗:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ リリース不変条件 OK（version=${version}）`);
