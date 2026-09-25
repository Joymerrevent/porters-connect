#!/usr/bin/env node
// リリースの流れの PR（リリース PR・back-merge PR）と main への push が、develop と比べて「版番号と
// 文書だけ」の違いしか持たないかを判定する。そうなら `stryker`（約 11 分）を省いてよい。
//
// なぜ要るか: リリース PR は base（main）との差分で見るので、前のリリース以降に develop へ入った
// コードがすべて「変更」に見え、docs-only の判定（ADR-0028）に掛からない。back-merge PR は
// main への push と同じコミットを検査する。どちらも、コードは develop へのマージ時に必須の
// `stryker` を通ったものと同じ（0.22.0 では同じコードに 3 回走った）。
//
// 判定: 検査対象（PR のマージ結果）と `origin/develop` のツリーの差が、
//   - コードでないもの（`**/*.md`・`docs/**`。ADR-0028 の code フィルタの否定と同じ）
//   - `package.json` の `version` だけの変更
// に収まるときだけ `bookkeeping=true`。それ以外（コード・依存・設定の変更、develop が先に
// 進んで差が出た場合も含む）は `false`＝フル run。
//
// 判定に失敗したら `false` を返す（skip しない）。省くのは速度のためで、判定が壊れたときに
// 検査が消えるのは逆向き。失敗はワークフローのログに warning で残す。
//
// 使い方（CI）: node scripts/detect-release-bookkeeping.mjs origin/develop HEAD >> "${GITHUB_OUTPUT}"
// 根拠: ADR-0028 の訂正（2026-09-23）

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** コードでないファイルか（ADR-0028 の code フィルタ `!**\/*.md` かつ `!docs/**` の否定）。 */
export const isNonCode = (path) =>
  path.endsWith(".md") || path.startsWith("docs/");

/** `version` を除いた `package.json` が同じか。読めなければ例外（呼び出し側で false に倒す）。 */
export const isVersionOnlyChange = (before, after) => {
  const strip = (text) => {
    const { version: _version, ...rest } = JSON.parse(text);
    return JSON.stringify(rest);
  };
  return strip(before) === strip(after);
};

/**
 * 変更ファイルの一覧から判定する。`readPackage(side)` は `"base"` / `"head"` の
 * `package.json` の中身を返す（テストでは差し替える）。
 */
export const judge = (files, readPackage) => {
  for (const file of files) {
    if (isNonCode(file)) continue;
    if (file === "package.json") {
      if (isVersionOnlyChange(readPackage("base"), readPackage("head"))) {
        continue;
      }
      return {
        bookkeeping: false,
        reason: "package.json に version 以外の変更がある",
      };
    }
    return { bookkeeping: false, reason: `コードの変更がある: ${file}` };
  }
  return {
    bookkeeping: true,
    reason:
      files.length === 0
        ? "develop と同じツリー"
        : "develop との違いは文書と version だけ",
  };
};

/** git から変更一覧と package.json を読んで判定する。失敗したら skip しない側に倒す。 */
export const detect = (base, head, git) => {
  try {
    const files = git(["diff", "--name-only", base, head])
      .split("\n")
      .filter((line) => line !== "");
    const refs = { base, head };
    return judge(files, (side) => git(["show", `${refs[side]}:package.json`]));
  } catch (error) {
    return {
      bookkeeping: false,
      // ワークフローの `::warning::` は 1 行しか出ないので、git のメッセージの改行を詰める。
      reason: `判定できなかったのでフル run にする: ${(error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").trim()}`,
      failed: true,
    };
  }
};

// CLI として実行されたときだけ走らせる（テストからは import して関数を呼ぶ）。
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [base, head] = process.argv.slice(2);
  const git = (args) =>
    execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  const result =
    base && head
      ? detect(base, head, git)
      : {
          bookkeeping: false,
          reason: "引数が足りない（base と head を渡す）",
          failed: true,
        };
  if (result.failed) console.error(`::warning::${result.reason}`);
  else console.error(result.reason);
  console.log(`bookkeeping=${result.bookkeeping}`);
}
