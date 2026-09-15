#!/usr/bin/env node
// Markdown のリンク先が実在するかの検査。
//
// なぜ要るか: markdownlint の MD052 は「**ラベルが未定義**」を見るだけで、
// **リンク先のファイルがあるか**は見ない。つまり `[x]: ./gone.md` は lint を通る。
// このセッションで手動チェックを 2 回走らせ、**2 回とも実際に壊れたリンクが出た**
// （ADR-0070 の移設で 7 本／兄弟ファイル間の相対リンク）。人がやると忘れるので機械に渡す。
//
// 何を見るか: 参照スタイルの定義（`[label]: path`）と inline のリンク（`](path)`）。
// 外部 URL とページ内アンカー（`#…`）は対象外。アンカー付きのパスはファイル部分だけ見る。
// コードフェンスの中と**インラインのコードスパン**は**説明のための例**なので見ない
// （リンクの書き方を説明する文章が、説明しただけで壊れリンクとして報告されるのを防ぐ）。
//
// 実在判定は **git の索引**（追跡済み ＋ 未追跡）に聞く。ファイルシステムに聞くと
// macOS（大文字小文字を区別しない）では `../INDEX.md` が通り、CI の ext4 では落ちる
// ＝手元で再現しない赤になる。索引なら綴りが 1 つに決まるので、どの OS でも同じ結果になる。
//
// 使い方: `pnpm check:links`

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

// 生成物と、リポジトリの文書ではないもの。`docs/usage/api` は TypeDoc の出力（`pnpm check:api` が見る）。
const SKIP_PREFIXES = ["docs/usage/api/", ".claude/"];

// 検査対象に必ず含まれるはずのファイル。ここを確かめないと、ディレクトリを移した / 除外を
// 増やした / 別の場所から起動した、のいずれでも「0 ファイルを検査しました」と言って**緑で
// 抜ける**。ゲートが残ったまま中身だけ消えるのが最悪なので、空振りは赤にする
// （兄弟の `check-doc-examples.mjs` の `MIN_BLOCKS` と同じ規律）。
const SENTINELS = ["README.md", "docs/usage/index.md"];

// リンク先として「この環境にしか無い」ことを許す接頭辞。ADR が取得した PORTERS の原記事
// （`tmp/porters-docs/…`）がこれに当たる。**gitignore 全体を除外条件にしない** — それだと
// `.gitignore` が育つたびに検査の盲点が黙って広がる。増やすときはここに書き足す＝
// 「何を見ないことにしたか」がコードに残る。
const IGNORABLE_TARGET_PREFIXES = ["tmp/"];

// inline リンクの宛先として「リンクとして成立する形」と見なす拡張子。
//
// なぜ allowlist なのか: inline の宛先は**散文と見分けが付かない**。リポジトリには
// `](…)` のように「リンクではないのに `](…)` の形をした散文」が実在するので、
// 何でも拾うと壊れリンクとして誤検出する（RV-38）。`./` `../` で始まる形は宛先だと
// 断定できるので無条件に拾い、それ以外は**拡張子で絞る**。
//
// 中身の根拠（実測 2026-09-15）: リポジトリ内のリンク先の拡張子は `.md` 1399 /
// `.mjs` 5 / `.ts` 2 ／ 残りはディレクトリ指し（16 件・すべて `./` `../` 付き）。
// 将来出てきそうな隣接だけを足してある。**ここに無い拡張子は `./` を付けたときだけ
// 検査される**＝「何を見ないことにしたか」がコードに残る形にしている。
const LINK_EXTENSIONS = new Set([
  "md",
  "ts",
  "mts",
  "cts",
  "tsx",
  "js",
  "mjs",
  "cjs",
  "json",
  "yml",
  "yaml",
  "sh",
  "txt",
  "svg",
  "png",
]);

// inline の宛先を拾うか。散文を巻き込まないための門。
const isLinkShaped = (target) => {
  // 明示的な相対パスとページ内アンカーは、リンク以外の解釈が無い。
  if (/^\.{1,2}\//.test(target) || target.startsWith("#")) return true;
  const path = target.split("#")[0];
  // パスに使える字だけで出来ていること（空白・読点・角括弧・三点リーダを弾く）。
  if (!/^[A-Za-z0-9._~@%+/-]+$/.test(path)) return false;
  const ext = /\.([A-Za-z0-9]+)$/.exec(path)?.[1].toLowerCase();
  return ext !== undefined && LINK_EXTENSIONS.has(ext);
};

// **追跡済み ＋ 未追跡（gitignore 対象を除く）**。`git ls-files` だけでは
// **新しく書いたページが検査されない** — いちばん必要なときに効かない形になる（実際に踏んだ）。
const allPaths = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter((p) => p !== "");

const files = allPaths
  .filter((f) => f.endsWith(".md"))
  .filter((f) => !SKIP_PREFIXES.some((p) => f.startsWith(p)));

const missingSentinels = SENTINELS.filter((s) => !files.includes(s));
if (missingSentinels.length > 0) {
  console.error(
    `検査が空振りしています（対象 ${String(files.length)} ファイル）。必ずあるはずの ` +
      `${missingSentinels.join(" / ")} が対象に入っていません。\n` +
      `リポジトリのルートで実行しているか、ドキュメントの場所や SKIP_PREFIXES が変わっていないか確認してください。`,
  );
  process.exit(1);
}

// 実在判定用。ファイルと、その祖先ディレクトリ（`[x]: ../reference/resources/` のような
// ディレクトリ指しのリンクがあるため）。
const fileSet = new Set(allPaths);
const dirSet = new Set();
for (const p of allPaths) {
  let d = dirname(p);
  while (d !== "." && d !== "/" && !dirSet.has(d)) {
    dirSet.add(d);
    d = dirname(d);
  }
}
const existsInRepo = (path) => fileSet.has(path) || dirSet.has(path);

/**
 * インラインのコードスパン（バッククォート 1 組）を空白に潰す。
 *
 * なぜ要るか: リンクの**書き方を説明する文章**（`` `[x](./gone.md)` `` のような引用）が、
 * 説明しただけで壊れリンクとして報告される。フェイルクローズなので見逃しではないが、
 * 書き手はフェンスへ逃がすか表現を変えることになり、**引用が書けない**（RV-40）。
 *
 * 対応付けはフェンスと同じ考え方（開いたのと**同じ長さ**のバッククォート列で閉じる）。
 * 中身は**空白に置き換える**＝列の位置を保つので、置換で行の構造（行頭の字下げや
 * 定義の `[label]:`）が動かない。閉じが無ければコードスパンではないのでそのまま残す。
 */
const maskCodeSpans = (line) => {
  const runs = [...line.matchAll(/`+/g)].map((m) => ({
    at: m.index,
    len: m[0].length,
  }));
  const chars = [...line];
  let i = 0;
  while (i < runs.length) {
    const open = runs[i];
    const closeAt = runs.findIndex((r, j) => j > i && r.len === open.len);
    if (closeAt === -1) {
      i += 1;
      continue;
    }
    const close = runs[closeAt];
    for (let p = open.at; p < close.at + close.len; p += 1) chars[p] = " ";
    i = closeAt + 1;
  }
  return chars.join("");
};

/**
 * 1 ファイル分のリンク先（行番号つき）と、フェンスが閉じていなければその開始行。
 *
 * フェンスの開閉は**ファイル全体にまたがる状態**なので、閉じ忘れると**それ以降のリンクが
 * 黙って検査対象から消える**（検査したつもりで何も見ていない状態）。閉じていないまま
 * 終端に着いたら、それ自体を報告する＝安全側に倒す。
 */
const linksOf = (file) => {
  const out = [];
  // 開いているフェンス（`null` = 外）。閉じ記号は**同じ文字で、開いたのと同じ長さ以上**
  // という CommonMark の規則に合わせる。単純な on/off にすると、フェンスを入れ子にした
  // 文書（```` で ``` を囲む形）で開閉が逆転し、**以降のリンクが黙って消える**。
  let fence = null;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      // コードフェンスの中は例。`[x]: ./gone.md` と書いてあってもリンクではない。
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (marker) {
        const [char, len] = [marker[1][0], marker[1].length];
        if (fence === null) fence = { char, len, line: i + 1 };
        else if (char === fence.char && len >= fence.len) fence = null;
        return;
      }
      if (fence !== null) return;
      // 以降はコードスパンを潰した行で見る（生の行はフェンス判定にだけ使う）。
      const text = maskCodeSpans(line);
      const push = (target) => out.push({ target, line: i + 1 });
      // 参照スタイルの定義: `[label]: target`。CommonMark は 3 個までの字下げ、
      // `<…>` 囲み、末尾のタイトル（`"…"` / `'…'` / `(…)`）を許す。狭く書くと**通るのに
      // 検査されない**行ができるので、そこまで受ける。タイトルの形は正規形だけに限る
      // （何でも許すと `[注]: これは説明です` のような散文を拾って誤検出になる）。
      const def =
        /^\s{0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*$/.exec(
          text,
        );
      if (def) push(def[1].replace(/^<|>$/g, ""));
      // inline のリンク: `](./x.md)` / `](x.md)` / `](./x.md "Title")` / `](<./x.md>)`。
      // 宛先の形は定義側と揃える（`<…>` 囲み・末尾タイトルの 3 形）。**どれを拾うかは
      // `isLinkShaped` が決める**＝散文を巻き込まずに `./` 無しとタイトル付きを拾う（RV-38）。
      // inline リンク自体は markdownlint の MD054 が禁止しているので人が書く文書には
      // 出ないが、`MD054` の対象外（CHANGELOG.md / .changeset/）を守るのはここ。
      for (const m of text.matchAll(
        /\]\(\s*(<[^>]*>|[^()\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g,
      )) {
        const target = m[1].replace(/^<|>$/g, "");
        if (isLinkShaped(target)) push(target);
      }
    });
  return { links: out, unclosedFenceAt: fence === null ? 0 : fence.line };
};

const problems = [];
const unreadable = [];
const unclosed = [];
let ignoredTargets = 0;
for (const file of files) {
  let links;
  try {
    const read = linksOf(file);
    links = read.links;
    if (read.unclosedFenceAt !== 0)
      unclosed.push(`${file}:${String(read.unclosedFenceAt)}`);
  } catch (e) {
    // 索引にあるのに作業ツリーに無い＝`git rm` せずに消した / `git mv` せずに移した状態。
    // ここで生の ENOENT を投げると、**ページを移す作業中**（このゲートが最も要る場面）に
    // 壊れリンク一覧ではなく node の内部エラーが出る＝落ちた理由が事実と違うものになる。
    unreadable.push(`${file}（${e instanceof Error ? e.message : String(e)}）`);
    continue;
  }
  for (const { target, line } of links) {
    // 外部・アンカーのみ・プロトコル相対は対象外
    if (/^(https?:|mailto:|#|\/\/)/.test(target)) continue;
    const path = target.split("#")[0];
    if (path === "") continue; // 同一ページ内アンカー
    const resolved = normalize(join(dirname(file), path)).replace(/\/+$/, "");
    if (existsInRepo(resolved)) continue;
    // 手元にしか無いことを許した場所（`tmp/` の原記事）は数えるだけ。
    if (IGNORABLE_TARGET_PREFIXES.some((p) => resolved.startsWith(p))) {
      ignoredTargets += 1;
      continue;
    }
    problems.push(`${file}:${String(line)} -> ${target}`);
  }
}

// 除外した件数は**成功時も失敗時も**出す。成功時だけ出すと、赤いときに「何を見なかったか」が
// 消える（見なかったものこそ記録が要る）。
const note =
  ignoredTargets > 0
    ? `／リポジトリ外を指すリンク ${String(ignoredTargets)} 件は対象外（${IGNORABLE_TARGET_PREFIXES.join(" / ")}）`
    : "";

// 3 種類の異常は**1 回の実行で全部出す**。先に見つけたほうで打ち切ると、残りは次の実行まで
// 見えない（同じ往復を人間が繰り返すことになる）。
if (unreadable.length > 0) {
  console.error(
    `索引にあるのに読めないファイルがあります（${String(unreadable.length)} 件）:`,
  );
  for (const u of unreadable) console.error(`  ${u}`);
  console.error(
    "→ 消したなら `git rm`、移したなら `git add -A` で索引と作業ツリーを揃えてください。\n",
  );
}

if (unclosed.length > 0) {
  console.error(
    `コードフェンスが閉じていません（${String(unclosed.length)} 件）。閉じるまで、その行から先のリンクは検査できません:`,
  );
  for (const u of unclosed) console.error(`  ${u}`);
  console.error("");
}

if (problems.length > 0) {
  console.error(
    `リンク先が見つかりません（${String(problems.length)} 件${note}）:`,
  );
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "→ ファイルを移したなら参照元も直してください（`git mv` はリンクを直しません）。\n",
  );
}

if (unreadable.length + unclosed.length + problems.length > 0) process.exit(1);

console.log(
  `リンク先はすべて実在します（${String(files.length)} ファイルを検査${note}）。`,
);
