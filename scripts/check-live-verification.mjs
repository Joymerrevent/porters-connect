#!/usr/bin/env node
// live-verification の LV ↔ コードの `VERIFY(live)` を**双方向**で突合する（RV-50）。
//
// なぜ要るか: live-verification.md は「コードに `VERIFY(live)` を置いてあり、grep で双方向に
// 対応付けできます」と宣言し、roadmap の `1.0.0` 条件 V4 もその 1:1 対応を測り方に採っている。
// **実測したら両方向で崩れていた**（2026-09-18・RV-50）:
//
//   - LV → コード: LV-13 / LV-18 / LV-23 は本文が「コード箇所」を名指すのにマーカーが無かった
//   - コード → LV: 4 件のマーカーが番号を持たず、うち 3 件は**対応するエントリが存在しなかった**
//
// 後者が重い。表に無い仮定は**契約後の確認リストに乗らない**ので、V5（全件確定）が緑になっても
// 誰も確かめない。人手の grep に任せると同じことが静かに再発するので、仕組みで押さえる。
//
// 何を見るか:
//   1) `src`/`test` の `VERIFY(live)` はすべて `LV-N` を 1 つ以上含む（番号を書かせれば
//      「エントリの無いマーカー」は構造的に起きない）
//   2) マーカーが参照する `LV-N` が表に実在する
//   3) 表の **`未確認`** のエントリは 1 箇所以上から参照されている
//      （`確定` / `解消` はマーカーを外すのが正しいので対象外 — 状態の意味は
//      docs/live-verification.md「状態の意味」節）
//   4) サマリー表と本文見出しが 1 対 1、状態は 3 語の語彙に収まる
//
// 使い方: `pnpm check:lv`（`pnpm check` に載っている）。

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const LV_DOC = "docs/live-verification.md";
export const CODE_ROOTS = ["src", "test"];
export const STATUSES = new Set(["未確認", "確定", "解消"]);

// マーカーは 1 行に収まらない（説明が数行続く）。トークンの行から数行内に番号があればよい、
// という緩さは**採らない** — 「同じコメント塊の中」を範囲とし、空行か非コメント行で切る。
// 行数で切ると、次のコメント塊の番号を自分のものと誤認できてしまう。
const MARKER = "VERIFY(live)";
const LV_REF = /LV-(\d+)/g;

const isCommentLine = (line) => {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
};

/** マーカーを含むコメント塊の本文（トークン行から塊の終端まで）を返す。 */
export const markerBlocks = (text) => {
  const lines = text.split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(MARKER)) continue;
    const collected = [lines[i]];
    for (let j = i + 1; j < lines.length; j++) {
      if (!isCommentLine(lines[j])) break;
      // 同じ塊の中に次のマーカーが来たら、そこからは別のマーカーの領域。
      if (lines[j].includes(MARKER)) break;
      collected.push(lines[j]);
    }
    blocks.push({ line: i + 1, text: collected.join("\n") });
  }
  return blocks;
};

/** サマリー表の行（`| LV-1 | … | 未確認 |`）から番号→状態を読む。 */
export const parseSummary = (doc) => {
  const rows = new Map();
  for (const m of doc.matchAll(
    /^\|\s*LV-(\d+)\s*\|([^|]*)\|\s*([^|]+?)\s*\|\s*$/gm,
  )) {
    rows.set(Number(m[1]), m[3].trim());
  }
  return rows;
};

/** 本文の見出し（`## LV-1 …`）から番号を読む。 */
export const parseHeadings = (doc) =>
  new Set([...doc.matchAll(/^## LV-(\d+)\b/gm)].map((m) => Number(m[1])));

const tsFiles = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) tsFiles(p, out);
    else if (/\.[cm]?tsx?$/.test(name)) out.push(p);
  }
  return out;
};

export const check = (
  read = readFileSync,
  listFiles = () => CODE_ROOTS.flatMap((r) => tsFiles(r)),
) => {
  const problems = [];
  const doc = String(read(LV_DOC, "utf8"));
  const summary = parseSummary(doc);
  const headings = parseHeadings(doc);

  if (summary.size === 0) {
    problems.push(
      `${LV_DOC}: サマリー表から LV の行を 1 つも読めませんでした（表の書式が変わった？）`,
    );
    return problems;
  }

  // (4) 表 ↔ 見出し、状態の語彙
  for (const [n, status] of summary) {
    if (!headings.has(n))
      problems.push(
        `${LV_DOC}: LV-${n} が表にあるのに本文の見出しがありません`,
      );
    if (!STATUSES.has(status))
      problems.push(
        `${LV_DOC}: LV-${n} の状態「${status}」は語彙外です（${[...STATUSES].join(" / ")}）`,
      );
  }
  for (const n of headings) {
    if (!summary.has(n))
      problems.push(`${LV_DOC}: LV-${n} の見出しがあるのに表に行がありません`);
  }

  // (1)(2) コード → LV
  const referenced = new Set();
  for (const file of listFiles()) {
    const text = String(read(file, "utf8"));
    if (!text.includes(MARKER)) continue;
    for (const block of markerBlocks(text)) {
      const nums = [...block.text.matchAll(LV_REF)].map((m) => Number(m[1]));
      if (nums.length === 0) {
        problems.push(
          `${file}:${block.line}: VERIFY(live) に LV-N がありません` +
            `（番号が無いと、対応するエントリが無くても気づけません）`,
        );
        continue;
      }
      for (const n of nums) {
        referenced.add(n);
        if (!summary.has(n))
          problems.push(
            `${file}:${block.line}: LV-${n} を参照していますが ${LV_DOC} にありません`,
          );
      }
    }
  }

  // (3) LV → コード（未確認のみ）
  for (const [n, status] of summary) {
    if (status !== "未確認") continue;
    if (!referenced.has(n))
      problems.push(
        `${LV_DOC}: LV-${n} は「未確認」ですが、コードのどこからも参照されていません` +
          `（該当箇所に VERIFY(live) と LV-${n} を書いてください）`,
      );
  }
  return problems;
};

// CLI として実行されたときだけ走らせる（テストからは import して関数を呼ぶ）。
if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split("/").pop())
) {
  const problems = check();
  if (problems.length > 0) {
    console.error("LV とコードの対応が取れていません:\n");
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      `\n${LV_DOC} か、コード側の VERIFY(live) のどちらかを直してください。` +
        `\n状態の意味（未確認 / 確定 / 解消）は同ファイルの「状態の意味」節にあります。`,
    );
    process.exit(1);
  }
  const counts = { 未確認: 0, 確定: 0, 解消: 0 };
  for (const status of parseSummary(
    String(readFileSync(LV_DOC, "utf8")),
  ).values())
    counts[status] += 1;
  console.log(
    `LV とコードの対応は取れています（未確認 ${counts.未確認} ／ 確定 ${counts.確定} ／ 解消 ${counts.解消}）。`,
  );
}
