#!/usr/bin/env node
// 公開している記号が、入門か目的別のどこかから**辿れる**かの検査（[ADR-0070] 論点4 の検査③）。
//
// なぜ要るか: 「リファレンスには載っているが、使い方を誰も書いていない」を防ぐため。ADR-0070 は
// この形のずれ（記号リファレンスを作ったのに V2 が満たされなかった）を起点に書かれている。
// 記号を足したときに「どのページで説明するか」を考えさせるのが目的で、逆に言えば
// **説明する気が無い記号は公開しない**という圧力にもなる。
//
// 対象の範囲について: ADR の文言は「`docs/api` の各記号ページ」だが、ここでは
// **値として呼ぶ記号**（クラスと関数）に絞る。型エイリアス 161 件は署名に現れるもので、
// HOWTO が名前で呼ぶ対象ではない（`ActivityUpdateInput` を名指しするページは書けないし、
// 書いても読者の役に立たない）。広げたくなったら SCOPE に足す — そのとき 161 件を
// どう扱うかを決める必要がある。
//
// 使い方: `pnpm check:mentions`

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join } from "node:path";

// 生成物のうち「値として呼ぶ記号」。TypeDoc の出力ディレクトリ構成に対応する。
const API_DIR = "docs/usage/api";
const SCOPE = ["classes", "functions"];

// 言及を探す先。ADR-0070 の「HOWTO / 入門ページ」。
const GUIDE_GLOBS = ["docs/usage/start/**/*.md", "docs/usage/howto/**/*.md"];

/**
 * 言及が無くてよい記号と、その理由。**理由を必須にする**のは、外した記録が残らないと
 * 「面倒だから外した」と「書けない理由がある」を後から区別できないため。
 */
const EXEMPT = new Map([
  // 例: ["SomeSymbol", "内部利用者向けで、利用者のガイドに出す予定が無い"],
]);

const symbols = SCOPE.flatMap((dir) => {
  const path = join(API_DIR, dir);
  if (!existsSync(path)) return [{ missingDir: path }];
  return readdirSync(path)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ name: f.replace(/\.md$/, ""), from: `${dir}/${f}` }));
});

const missingDirs = symbols.filter((s) => s.missingDir);
if (missingDirs.length > 0) {
  console.error(
    `検査対象の生成物が見つかりません: ${missingDirs.map((s) => s.missingDir).join(" / ")}\n` +
      `API_DIR / SCOPE を直すか、\`pnpm docs:api\` で生成してください。`,
  );
  process.exit(1);
}

const guides = GUIDE_GLOBS.flatMap((g) => globSync(g));
// 番人（ADR-0071 論点2 と同じ規律）。対象ゼロで緑になると、検査があるのに何も見ていない。
if (symbols.length === 0 || guides.length === 0) {
  console.error(
    `検査が空振りしています（記号 ${String(symbols.length)} ／ ガイド ${String(guides.length)}）。\n` +
      `API_DIR / SCOPE / GUIDE_GLOBS がドキュメントの現在地と合っているか確認してください。`,
  );
  process.exit(1);
}

const corpus = guides.map((f) => ({ file: f, text: readFileSync(f, "utf8") }));

const unmentioned = [];
for (const { name, from } of symbols) {
  if (EXEMPT.has(name)) continue;
  // 単語境界で見る（`PortersError` が `PortersAuthError` に含まれる、のような取り違えを避ける）。
  const re = new RegExp(`(?<![A-Za-z0-9_$])${name}(?![A-Za-z0-9_$])`);
  const hits = corpus.filter((c) => re.test(c.text));
  if (hits.length === 0) unmentioned.push({ name, from });
}

const exemptNote = EXEMPT.size > 0 ? `／除外 ${String(EXEMPT.size)} 件` : "";

if (unmentioned.length === 0) {
  console.log(
    `公開記号はすべてガイドから辿れます（${String(symbols.length)} 記号 ／ ${String(guides.length)} ページ${exemptNote}）。`,
  );
  process.exit(0);
}

console.error(
  `ガイドから辿れない公開記号があります（${String(unmentioned.length)} 件）:\n`,
);
for (const u of unmentioned)
  console.error(`  ${u.name}（${API_DIR}/${u.from}）`);
console.error(
  `\n入門（docs/usage/start）か目的別（docs/usage/howto）のどこかで使い方に触れてください。\n` +
    `触れないと決めたなら、${"scripts/check-api-mentions.mjs"} の EXEMPT に理由つきで足します。`,
);
process.exit(1);
