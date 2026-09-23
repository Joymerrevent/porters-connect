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
 * （[ADR-0070] 論点4 の検査①。階層は [ADR-0088] の 5 章 ＋ 訂正注記の「クライアント」「関数」）。
 *
 * 目次に無いページは**誰からも辿れない**＝書いたのに読まれない。逆に目次にあるのに
 * ファイルが無いのは 404。どちらも「黙って起きる」ので機械で止める。
 *
 * 対象は `docs/usage/{start,topics,client,resources,functions,recipes}` の 6 階層だけ。`reference/` と `api/` は
 * それぞれ別の索引を持ち、`api/` は生成物（`pnpm check:api` が見る）。
 */
const USER_DOC_DIRS = [
  "start",
  "topics",
  "client",
  "resources",
  "functions",
  "recipes",
];

export const checkUserDocIndex = (read = readFileSync) => {
  const problems = [];
  const indexPath = "docs/usage/index.md";
  let index;
  try {
    index = read(indexPath, "utf8");
  } catch {
    return [`${indexPath} がありません（利用者向けドキュメントの目次）`];
  }
  // 参照スタイルの定義から、4 階層へのリンクだけを拾う。
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
      // 移設したのに定数を直し忘れると検査が静かに空振りする。6 階層はすべて実在する前提。
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

/**
 * 引く層（`docs/usage/{topics,client,resources,functions,recipes}`）の各ページに**出口**があるかの検査
 * （[ADR-0070] 追記の検査⑤。階層は [ADR-0088] の 5 章 ＋ 訂正注記の「クライアント」「関数」で、
 * 目的別 1 階層から 5 階層に広がった）。
 *
 * 入門と違い、引く層は**順序が無い**（目次から主題・リソース・用途で引いて 1 本読む層）。だから鎖では
 * なく、「読み終えた人が次へ移れること」だけを見る。具体的には `## 関連` を持ち、その節から
 * **目次へ戻れる**こと。実測（2026-09-12）では目的別 9 本中 3 本に節が無く、1 本は別名だった。
 *
 * 検出するもの: `## 関連` の欠落／関連から目次へのリンクが無い／階層ごと消えた（番人・階層ごと）。
 */
const EXIT_DIRS = [
  "docs/usage/topics",
  "docs/usage/client",
  "docs/usage/resources",
  "docs/usage/functions",
  "docs/usage/recipes",
];
const EXIT_SECTION = "## 関連";
const EXIT_TARGET = "../index.md";

/** `## 関連` 以降（次の `## ` 手前まで）を返す。節が無ければ `undefined`。 */
const relatedSection = (body) => {
  const start = body.indexOf(`\n${EXIT_SECTION}\n`);
  if (start === -1) return undefined;
  const rest = body.slice(start + EXIT_SECTION.length + 2);
  const end = rest.indexOf("\n## ");
  return end === -1 ? rest : rest.slice(0, end);
};

/** 参照スタイルのラベルを本文末の定義で解決して、リンク先の集合を返す。 */
const linkTargets = (body, section) => {
  const targets = [];
  for (const [, label] of section.matchAll(/\[[^\]]*\]\[([^\]]+)\]/g)) {
    const def = new RegExp(`^\\[${label}\\]:\\s*(\\S+)$`, "m").exec(body);
    if (def) targets.push(def[1]);
  }
  for (const [, target] of section.matchAll(/\[[^\]]*\]\((\S+?)\)/g))
    targets.push(target);
  return targets;
};

export const checkExits = (
  read = readFileSync,
  list = (dir) => readdirSync(dir),
  dirs = EXIT_DIRS,
) => {
  const problems = [];
  for (const dir of dirs) {
    let files;
    try {
      files = list(dir).filter((f) => f.endsWith(".md"));
    } catch {
      // **番人**（ADR-0071 論点2）。階層を移すと、この検査は対象ゼロで黙って緑になる。
      // 5 階層のどれか 1 つが消えても落ちるよう、階層ごとに見る。
      problems.push(
        `検査対象が見つかりません: ${dir}（EXIT_DIRS を直すか、移設を戻す）`,
      );
      continue;
    }
    if (files.length === 0) {
      problems.push(
        `${dir} に .md がありません（EXIT_DIRS を直すか、移設を戻す）`,
      );
      continue;
    }
    for (const f of files.sort()) {
      const body = read(join(dir, f), "utf8");
      const section = relatedSection(body);
      if (section === undefined) {
        problems.push(
          `${dir}/${f}: \`${EXIT_SECTION}\` の節がありません（読み終えた人の出口が無い）`,
        );
        continue;
      }
      const exits = linkTargets(body, section).filter((t) =>
        t.startsWith(EXIT_TARGET),
      );
      if (exits.length === 0)
        problems.push(
          `${dir}/${f}: \`${EXIT_SECTION}\` から目次（${EXIT_TARGET}）へ戻れません`,
        );
    }
  }
  return problems;
};

/**
 * リソース別（`docs/usage/resources/`）とアクセサの**両方向**突合（[ADR-0088] の検査⑥）。
 *
 * 「1 リソース 1 ページ」は、ページが無いリソースがあると引く軸として壊れる。逆にアクセサの無い
 * ページは 404 と同じ。どちらも黙って起きるので、公開 API の実体（`src/client.ts` の
 * `readonly x: XResource | XAccessor`＝ `TenantScope` の 17 個と client 直下の `partition`）と
 * `resources/*.md` を突き合わせる。D4（reference ↔ カタログ）と同じ形。
 *
 * 検出するもの: アクセサにページが無い／ページにアクセサが無い／アクセサが 1 つも拾えない・
 * 階層が消えた（番人）。
 */
const CLIENT_SOURCE = "src/client.ts";
const RESOURCES_DIR = "docs/usage/resources";
const RESOURCES_INDEX = "README.md";

/** `readonly candidate: CandidateResource<…>` / `readonly phase: PhaseAccessor` の名前を採る。 */
export const accessorNames = (source) =>
  [...source.matchAll(/^\s*readonly (\w+): \w+(?:Resource|Accessor)\b/gm)].map(
    (m) => m[1],
  );

export const checkResourcePages = (
  read = readFileSync,
  list = () => readdirSync(RESOURCES_DIR),
) => {
  let source;
  try {
    source = read(CLIENT_SOURCE, "utf8");
  } catch {
    return [
      `${CLIENT_SOURCE} が読めません（CLIENT_SOURCE を直すか、移設を戻す）`,
    ];
  }
  const accessors = accessorNames(source);
  // **番人**。宣言の書き方が変わると 0 個になり、「ページが要るアクセサは無い」と読んで緑になる。
  if (accessors.length === 0)
    return [
      `${CLIENT_SOURCE} にアクセサ（readonly x: XResource | XAccessor）が見つかりません（宣言の形が変わったなら accessorNames を直す）`,
    ];
  let pages;
  try {
    pages = list()
      .filter((f) => f.endsWith(".md") && f !== RESOURCES_INDEX)
      .map((f) => f.replace(/\.md$/, ""));
  } catch {
    return [
      `検査対象が見つかりません: ${RESOURCES_DIR}（RESOURCES_DIR を直すか、移設を戻す）`,
    ];
  }
  const problems = [];
  for (const a of accessors)
    if (!pages.includes(a))
      problems.push(
        `アクセサ ${a} のページがありません: ${RESOURCES_DIR}/${a}.md（1 リソース 1 ページ）`,
      );
  for (const p of pages)
    if (!accessors.includes(p))
      problems.push(
        `ページに対応するアクセサがありません: ${RESOURCES_DIR}/${p}.md（${CLIENT_SOURCE} に無い）`,
      );
  return problems;
};

/**
 * クライアント（`docs/usage/client/`）と `PortersClient` の**両方向**突合（[ADR-0088] 訂正注記で
 * 検査⑥を広げたもの）。リソース別の ⑥ が `TenantScope` のアクセサを見るのに対し、こちらは
 * **`PortersClient` 直下のメンバ**（`auth` / `tenant`。`partition` はリソース別が持つ）を見る。
 *
 * 検出するもの: メンバのページが無い／対応の決まっていないメンバが増えた／どのメンバでもない
 * ページがある／固定ページ（`client.md`）が無い／メンバが 1 つも拾えない・階層が消えた（番人）。
 */
const CLIENT_DIR = "docs/usage/client";
const CLIENT_FIXED_PAGES = ["client.md"];
/** `PortersClient` のメンバ → ページ。`null` は別の章（リソース別）が持つ。 */
const CLIENT_MEMBER_PAGES = {
  auth: "auth.md",
  tenant: "tenant-scope.md",
  partition: null,
};

/** `export class PortersClient { … }` の本体から `readonly x` の名前を採る（`#` の private は除く）。 */
export const clientMemberNames = (source) => {
  const start = source.indexOf("export class PortersClient");
  if (start === -1) return [];
  const body = source.slice(start);
  const end = body.indexOf("\n}");
  return [
    ...(end === -1 ? body : body.slice(0, end)).matchAll(
      /^\s*readonly (\w+)\b/gm,
    ),
  ].map((m) => m[1]);
};

export const checkClientPages = (
  read = readFileSync,
  listPages = () => readdirSync(CLIENT_DIR),
) => {
  let source;
  try {
    source = read(CLIENT_SOURCE, "utf8");
  } catch {
    return [
      `${CLIENT_SOURCE} が読めません（CLIENT_SOURCE を直すか、移設を戻す）`,
    ];
  }
  const members = clientMemberNames(source);
  // **番人**。クラスの書き方が変わると 0 個になり、「ページが要るメンバは無い」と読んで緑になる。
  if (members.length === 0)
    return [
      `${CLIENT_SOURCE} に PortersClient のメンバ（readonly x）が見つかりません（宣言の形が変わったなら clientMemberNames を直す）`,
    ];
  let pages;
  try {
    pages = listPages().filter((f) => f.endsWith(".md"));
  } catch {
    return [
      `検査対象が見つかりません: ${CLIENT_DIR}（CLIENT_DIR を直すか、移設を戻す）`,
    ];
  }
  const problems = [];
  for (const f of CLIENT_FIXED_PAGES)
    if (!pages.includes(f))
      problems.push(`${CLIENT_DIR}/${f} がありません（章の固定ページ）`);
  const expected = new Set(CLIENT_FIXED_PAGES);
  for (const m of members) {
    if (!(m in CLIENT_MEMBER_PAGES)) {
      problems.push(
        `PortersClient のメンバ ${m} にページの割り当てがありません（CLIENT_MEMBER_PAGES に足す）`,
      );
      continue;
    }
    const page = CLIENT_MEMBER_PAGES[m];
    if (page === null) continue;
    expected.add(page);
    if (!pages.includes(page))
      problems.push(`メンバ ${m} のページがありません: ${CLIENT_DIR}/${page}`);
  }
  for (const p of pages)
    if (!expected.has(p))
      problems.push(
        `ページに対応するメンバがありません: ${CLIENT_DIR}/${p}（PortersClient に無い）`,
      );
  return problems;
};

/**
 * 関数（`docs/usage/functions/`）と公開関数の**両方向**突合（[ADR-0088] 訂正注記の検査⑥の一部）。
 * 公開関数の実体は生成物 `docs/usage/api/functions/*.md`（`pnpm check:api` が最新を保つ）で、
 * 用途別の 3 ページの「呼べる関数」表と突き合わせる。
 *
 * 検出するもの: 公開関数がどのページの表にも載っていない／表にある名前が公開関数でない（綴り違い・
 * 消えた関数）／表が 1 つも無いページ／公開関数が 1 つも無い・階層が消えた（番人）。
 */
const FUNCTIONS_DIR = "docs/usage/functions";
const API_FUNCTIONS_DIR = "docs/usage/api/functions";

/** 表の行 `| \`name(...)\` | …` から関数名を採る（「呼べる関数」表の第 1 列だけ）。 */
export const listedFunctionNames = (body) =>
  [...body.matchAll(/^\| `(\w+)\(/gm)].map((m) => m[1]);

export const checkFunctionPages = (
  read = readFileSync,
  listPages = () => readdirSync(FUNCTIONS_DIR),
  listFunctions = () => readdirSync(API_FUNCTIONS_DIR),
) => {
  let functions;
  try {
    functions = listFunctions()
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
  } catch {
    return [
      `検査対象が見つかりません: ${API_FUNCTIONS_DIR}（API_FUNCTIONS_DIR を直すか、pnpm docs:api を実行する）`,
    ];
  }
  // **番人**。生成物が空だと「載せる関数は無い」と読んで緑になる。
  if (functions.length === 0)
    return [
      `${API_FUNCTIONS_DIR} に .md がありません（公開関数が 0 のはずはない。生成し直す）`,
    ];
  let pages;
  try {
    pages = listPages().filter((f) => f.endsWith(".md"));
  } catch {
    return [
      `検査対象が見つかりません: ${FUNCTIONS_DIR}（FUNCTIONS_DIR を直すか、移設を戻す）`,
    ];
  }
  if (pages.length === 0)
    return [`${FUNCTIONS_DIR} に .md がありません（用途別のページを置く）`];
  const problems = [];
  const listed = new Map(); // name -> page
  for (const f of pages.sort()) {
    const names = listedFunctionNames(read(join(FUNCTIONS_DIR, f), "utf8"));
    if (names.length === 0)
      problems.push(
        `${FUNCTIONS_DIR}/${f}: 「呼べる関数」の表に関数がありません（\`| \\\`name(\` の行）`,
      );
    for (const n of names) {
      if (!functions.includes(n))
        problems.push(
          `${FUNCTIONS_DIR}/${f}: ${n} は公開関数ではありません（${API_FUNCTIONS_DIR}/${n}.md が無い。綴りか、消えた関数）`,
        );
      listed.set(n, f);
    }
  }
  for (const n of functions)
    if (!listed.has(n))
      problems.push(
        `公開関数 ${n} が ${FUNCTIONS_DIR}/ のどのページにも載っていません（${API_FUNCTIONS_DIR}/${n}.md はある）`,
      );
  return problems;
};

export const checkAll = (targets = TARGETS, read = readFileSync) => [
  ...targets.flatMap((t) => checkTarget(t, read)),
  ...checkUserDocIndex(read),
  ...checkStartChain(read),
  ...checkExits(read),
  ...checkResourcePages(read),
  ...checkClientPages(read),
  ...checkFunctionPages(read),
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
