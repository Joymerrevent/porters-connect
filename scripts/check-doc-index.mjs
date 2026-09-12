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
    // 0000 は雛形（ADR の 0000-template.md と同じ扱い）＝索引に載らない
    skip: new Set(["0000"]),
    idFromRow: (cell) => cell.match(/RV-(\d+)/)?.[1]?.padStart(4, "0"),
    columns: [
      { header: "重要度", meta: "重要度" },
      { header: "観点", meta: "観点" },
      {
        header: "状態",
        meta: "状態",
        vocabulary: new Set(["open", "fixed", "wontfix", "deferred"]),
      },
      { header: "概要", meta: null },
    ],
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

/**
 * 利用者向けドキュメントの目次（`docs/usage/index.md`）と実ファイルの 1:1 突合
 * （[ADR-0070] 論点4 の検査①）。
 *
 * 目次に無いページは**誰からも辿れない**＝書いたのに読まれない。逆に目次にあるのに
 * ファイルが無いのは 404。どちらも「黙って起きる」ので機械で止める。
 *
 * 対象は `docs/usage/{start,concepts,howto}` の 3 階層だけ。`reference/` と `api/` は
 * それぞれ別の索引を持ち、`api/` は生成物（`pnpm check:api` が見る）。
 */
const USER_DOC_DIRS = ["start", "concepts", "howto"];

export const checkUserDocIndex = (read = readFileSync) => {
  const problems = [];
  const indexPath = "docs/usage/index.md";
  let index;
  try {
    index = read(indexPath, "utf8");
  } catch {
    return [`${indexPath} がありません（利用者向けドキュメントの目次）`];
  }
  // 参照スタイルの定義から、3 階層へのリンクだけを拾う。
  const linked = new Set(
    [...index.matchAll(/^\[[^\]]+\]:\s*(\S+)$/gm)]
      .map((m) => m[1])
      .filter((t) => USER_DOC_DIRS.some((d) => t.startsWith(`${d}/`))),
  );
  const actual = new Set();
  for (const dir of USER_DOC_DIRS) {
    let entries;
    try {
      entries = readdirSync(join("docs", "usage", dir));
    } catch {
      // **番人**（ADR-0071 論点2）。以前は「まだ無いディレクトリは対象外」と読み飛ばしていたが、
      // 移設したのに定数を直し忘れると検査が静かに空振りする。3 階層はすべて実在する前提。
      problems.push(
        `検査対象の階層が見つかりません: docs/usage/${dir}（USER_DOC_DIRS を直すか、移設を戻す）`,
      );
      continue;
    }
    for (const f of entries) if (f.endsWith(".md")) actual.add(`${dir}/${f}`);
  }
  for (const t of [...linked].sort())
    if (!actual.has(t)) problems.push(`目次にあるがファイルが無い: ${t}`);
  for (const t of [...actual].sort())
    if (!linked.has(t))
      problems.push(`ファイルがあるが目次に無い（誰からも辿れない）: ${t}`);
  return problems;
};

/**
 * 入門（`docs/usage/start/`）の鎖が切れていないかの検査（[ADR-0070] 論点4 の検査②）。
 *
 * 入門は**順に読む**ことが前提なので、各ページに `- **前提**:` と `- **次に読む**:` を置き、
 * **次に読むの連なりが全ページを 1 列に並べる**ことを機械で確かめる。人が順序を保つ形にすると、
 * ページを 1 本足した / 名前を変えた瞬間に**どこからも辿れないページ**が静かにできる
 * （ADR-0070 が 5 本に割ると決めた理由もここで、1 本の長いページだとこの検査が空振りする）。
 *
 * 検出するもの: メタ行の欠落／リンク切れ／鎖の分岐・輪・孤立／`前提` が鎖の 1 つ前と食い違う。
 */
const START_DIR = "docs/usage/start";
const META = { prev: "前提", next: "次に読む" };

/** `- **ラベル**: …` の行から、最初のリンク先（参照スタイルのラベルは定義で解決）を採る。 */
const metaLink = (body, label) => {
  const line = body.split("\n").find((l) => l.startsWith(`- **${label}**:`));
  if (line === undefined) return { found: false };
  const ref = /\[[^\]]*\]\[([^\]]+)\]/.exec(line);
  if (ref) {
    const def = new RegExp(`^\\[${ref[1]}\\]:\\s*(\\S+)$`, "m").exec(body);
    return { found: true, target: def?.[1], label: ref[1] };
  }
  const inline = /\[[^\]]*\]\((\S+?)\)/.exec(line);
  return { found: true, target: inline?.[1] };
};

export const checkStartChain = (read = readFileSync) => {
  const problems = [];
  let files;
  try {
    files = readdirSync(START_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    // **番人**（ADR-0071 論点2）。実測で、入門を移すとこの検査は対象ゼロで黙って緑になった。
    return [
      `検査対象が見つかりません: ${START_DIR}（START_DIR を直すか、移設を戻す）`,
    ];
  }
  if (files.length === 0) return problems;

  const next = new Map(); // file -> 次に読む先（start 内なら file 名、外なら null）
  const prev = new Map(); // file -> 前提が指す start 内のページ（無ければ undefined）
  for (const f of files) {
    const body = read(join(START_DIR, f), "utf8");
    for (const [key, label] of Object.entries(META)) {
      const link = metaLink(body, label);
      if (!link.found) {
        problems.push(
          `${START_DIR}/${f}: \`- **${label}**:\` の行がありません`,
        );
        continue;
      }
      if (link.label !== undefined && link.target === undefined) {
        problems.push(
          `${START_DIR}/${f}: ${label} のラベル \`${link.label}\` に定義がありません`,
        );
        continue;
      }
      // start 内を指すものだけを鎖として扱う（外を指すのは鎖の終端・前提の補足）。
      const inStart =
        link.target !== undefined && !link.target.includes("/")
          ? link.target
          : undefined;
      if (key === "next") next.set(f, inStart ?? null);
      else if (inStart !== undefined) prev.set(f, inStart);
      if (inStart !== undefined && !files.includes(inStart))
        problems.push(
          `${START_DIR}/${f}: ${label} が指す ${inStart} が ${START_DIR} にありません`,
        );
    }
  }
  if (problems.length > 0) return problems; // 鎖をたどる前に、材料の欠けを直す

  // 入口＝どのページの「次に読む」からも指されていないページ。1 つでなければ鎖ではない。
  const pointed = new Set([...next.values()].filter((v) => v !== null));
  const heads = files.filter((f) => !pointed.has(f));
  if (heads.length !== 1) {
    problems.push(
      `${START_DIR}: 入口が ${String(heads.length)} 個あります（${heads.join(" / ") || "なし＝輪になっています"}）。入門は 1 列に並んでいる必要があります`,
    );
    return problems;
  }

  const visited = [];
  for (let at = heads[0]; at !== null && at !== undefined; at = next.get(at)) {
    if (visited.includes(at)) {
      problems.push(`${START_DIR}: 鎖が輪になっています（${at} に戻りました）`);
      return problems;
    }
    visited.push(at);
  }
  const orphans = files.filter((f) => !visited.includes(f));
  if (orphans.length > 0)
    problems.push(
      `${START_DIR}: 鎖から辿れないページがあります: ${orphans.join(" / ")}`,
    );

  // 「前提」が鎖の 1 つ前と食い違っていないか（並べ替えたときに片方だけ直す事故を止める）。
  visited.forEach((f, i) => {
    const declared = prev.get(f);
    const actual = i === 0 ? undefined : visited[i - 1];
    if (declared !== undefined && declared !== actual)
      problems.push(
        `${START_DIR}/${f}: 前提が ${declared} を指していますが、鎖の 1 つ前は ${actual ?? "（入口なので無し）"} です`,
      );
  });
  return problems;
};

export const checkAll = (targets = TARGETS, read = readFileSync) => [
  ...targets.flatMap((t) => checkTarget(t, read)),
  ...checkUserDocIndex(read),
  ...checkStartChain(read),
];

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
      "\n索引（docs/adr/index.md・docs/usage/index.md ほか）か、各ファイルのどちらかを直してください。",
    );
    process.exit(1);
  }
  console.log("索引と本文は一致しています。");
}
