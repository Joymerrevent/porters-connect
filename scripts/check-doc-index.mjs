#!/usr/bin/env node
// 索引テーブル ↔ 各エントリ本文の突合（ADR-0053 軸3 / ADR-0052）。
//
// なぜ要るか: 状態を索引にも書く形は二重管理で、放置すると腐る。実測（2026-08-16）では
// ADR 索引の一覧テーブルは 53 本すべて健全だった一方、状態を散文で言い換えた節は 4 件が
// 陳腐化していた。「機械的に突合できる形なら生き残る」ことを仕組みで担保するのが本スクリプト。
//
// 何を見るか（対象ごとに同じ規律）:
//   1) 索引の行と実ファイルが 1 対 1（索引の幽霊行・ファイルの取りこぼしの両方）
//   2) 索引の各列が本文のメタ行と一致
//   3) 状態が既定の語彙に収まっている
// 「記載漏れ」ではなく「食い違い」を検出する＝任意項目（ADR の Implemented）は
// 両方が空でも通る。
//
// 使い方: `pnpm check:index`（CI では常時実行ブロックに置く。ADR-0028 のパスフィルタ配下だと
// docs-only の変更で走らず、検査が形だけになるため）。

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 表示幅ではなく意味で比較するため、セルは trim して突き合わせる。
const NONE = "—";

/**
 * 検査対象の定義。`index` は索引ファイル、`dir`/`pattern` はエントリ群、
 * `columns` は索引テーブルの列（`meta` はエントリ本文の対応するメタ行のラベル。
 * `null` は本文に対応物が無い＝突合しない列）。
 */
export const TARGETS = [
  {
    name: "ADR",
    index: "docs/adr/index.md",
    dir: "docs/adr",
    pattern: /^(\d{4})-.+\.md$/,
    skip: new Set(["0000"]),
    // 索引の行頭 `| [0001][0001] |` から番号を取る
    idFromRow: (cell) => cell.match(/\[(\d{4})\]/)?.[1],
    columns: [
      { header: "タイトル", meta: null },
      { header: "フェーズ", meta: null },
      {
        header: "ステータス",
        meta: "Status",
        vocabulary: new Set(["proposed", "accepted", "rejected", "deprecated"]),
        prefixMatch: "superseded",
      },
      { header: "実装", meta: "Implemented" },
    ],
  },
  {
    name: "findings",
    index: "docs/reviews/findings.md",
    dir: "docs/reviews/rv",
    pattern: /^(\d{4})-.+\.md$/,
    skip: new Set(),
    idFromRow: (cell) => cell.match(/RV-(\d+)/)?.[1]?.padStart(4, "0"),
    columns: [
      { header: "重要度", meta: "重要度" },
      { header: "観点", meta: "観点" },
      {
        header: "状態",
        meta: "状態",
        vocabulary: new Set(["open", "fixed", "wontfix", "deferred"]),
      },
    ],
    // 台帳がまだ分割されていない間は対象外（ADR-0052 の移行 PR で有効になる）
    optional: true,
  },
];

/** 本文のメタ行 `- ラベル: 値` を拾う。`重要度: 🔴 High ／ 観点: …` の複合行にも対応。 */
const readMeta = (body, label) => {
  const line = body
    .split("\n")
    .find((l) => l.startsWith(`- ${label}:`) || l.includes(`／ ${label}:`));
  if (line === undefined) return undefined;
  const after = line.split(`${label}:`)[1] ?? "";
  return after.split("／")[0].trim();
};

/** 索引の Markdown テーブルを {id, cells} の配列にする（区切り行とヘッダは除く）。 */
export const parseIndexTable = (text, idFromRow) => {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length === 0) continue;
    if (cells.every((c) => /^-+$/.test(c))) continue; // 区切り行
    const id = idFromRow(cells[0]);
    if (id === undefined) continue; // ヘッダ行など
    rows.push({ id, cells });
  }
  return rows;
};

const listEntries = (dir, pattern, skip) => {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return undefined; // ディレクトリ自体が無い
  }
  const out = new Map();
  for (const name of names) {
    const m = name.match(pattern);
    if (!m || skip.has(m[1])) continue;
    out.set(m[1], join(dir, name));
  }
  return out;
};

export const checkTarget = (target, read = readFileSync) => {
  const problems = [];
  const entries = listEntries(target.dir, target.pattern, target.skip);
  if (entries === undefined) {
    if (target.optional) return problems;
    problems.push(
      `${target.name}: エントリのディレクトリが見つからない (${target.dir})`,
    );
    return problems;
  }
  let indexText;
  try {
    indexText = read(target.index, "utf8");
  } catch {
    problems.push(`${target.name}: 索引が読めない (${target.index})`);
    return problems;
  }
  const rows = parseIndexTable(indexText, target.idFromRow);
  const indexIds = new Set(rows.map((r) => r.id));

  // (1) 1 対 1
  for (const id of entries.keys()) {
    if (!indexIds.has(id)) {
      problems.push(
        `${target.name}-${id}: 実ファイルがあるのに索引に行が無い (${entries.get(id)})`,
      );
    }
  }
  for (const id of indexIds) {
    if (!entries.has(id)) {
      problems.push(`${target.name}-${id}: 索引に行があるのに実ファイルが無い`);
    }
  }

  // (2)(3) 列の一致と語彙
  for (const row of rows) {
    const path = entries.get(row.id);
    if (path === undefined) continue;
    const body = read(path, "utf8");
    // 列は「# / ID」の次から並ぶ
    target.columns.forEach((col, i) => {
      const cell = row.cells[i + 1] ?? "";
      if (col.vocabulary !== undefined) {
        const ok =
          col.vocabulary.has(cell) ||
          (col.prefixMatch !== undefined && cell.startsWith(col.prefixMatch));
        if (!ok) {
          problems.push(
            `${target.name}-${row.id}: 索引の「${col.header}」が既定の語彙にない: "${cell}"`,
          );
        }
      }
      if (col.meta === null) return;
      const meta = readMeta(body, col.meta);
      const expected = meta ?? NONE;
      // 本文の Status は `superseded by [[0039]]` のように補足が付くため前方一致で見る
      const matched =
        cell === expected ||
        (col.prefixMatch !== undefined &&
          cell.startsWith(col.prefixMatch) &&
          expected.startsWith(col.prefixMatch));
      if (!matched) {
        problems.push(
          `${target.name}-${row.id}: 「${col.header}」が食い違う — 索引="${cell}" / 本文="${expected}"`,
        );
      }
    });
  }
  return problems;
};

export const checkAll = (targets = TARGETS, read = readFileSync) =>
  targets.flatMap((t) => checkTarget(t, read));

// CLI として実行されたときだけ走らせる（テストからは import して関数を呼ぶ）。
if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split("/").pop())
) {
  const problems = checkAll();
  if (problems.length > 0) {
    console.error("索引と本文が食い違っています:\n");
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      "\n索引（docs/adr/index.md ほか）か、各ファイルのメタ行のどちらかを直してください。",
    );
    process.exit(1);
  }
  console.log("索引と本文は一致しています。");
}
