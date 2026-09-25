#!/usr/bin/env node
// main 以外への PR で、ミューテーションテスト（stryker）をどのファイルに掛けるかを決める（ADR-0094）。
//
// なぜ要るか: コードを含む PR で毎回フル run（CI で約 10〜11 分）を待っていた。変更したファイルだけに絞れば
// 数分で済む。incremental（前回の結果の使い回し）は static mutant の結果を更新せず誤判定するので使わない
// （ADR-0015 の訂正）。ここで選んだファイルを `stryker run --mutate` に渡し、毎回ゼロから検査する。
//
// 判定（PR のマージ結果と base の差分の各ファイルについて）:
//   - コードでないもの（`**/*.md`・`docs/**`）・`scripts/`・`.github/`   → 対象にしない
//   - `package.json` の `version` だけの変更                           → 対象にしない
//   - `src/` の実装で、stryker.config.json の `mutate` に入るもの        → そのファイルを対象にする
//   - `src/` の隣のテスト（`x.test.ts`）で、隣の `x.ts` が `mutate` に入る → `x.ts` を対象にする
//   - それ以外（`mutate` の外の src・削除した src・`test/`・依存・設定…） → フル run
// 対象が 0 件なら skip。判定に失敗したらフル run（省くのは速度のためで、壊れたときに検査が消えるのは逆向き）。
//
// 使い方（CI）: node scripts/select-mutation-targets.mjs origin/develop HEAD >> "${GITHUB_OUTPUT}"
//   出力: `mode=skip|subset|full` と、subset のとき `targets=<カンマ区切りのパス>`
// 根拠: ADR-0094

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  isNonCode,
  isVersionOnlyChange,
} from "./detect-release-bookkeeping.mjs";

/** `src/**\/*.ts` のような glob を正規表現にする（`**` は途中のディレクトリ 0 個以上、`*` は `/` を含まない）。 */
export const globToRegExp = (glob) => {
  let source = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      // `**/` はディレクトリ 0 個以上。末尾の `**` は残り全部。
      if (glob[i + 2] === "/") {
        source += "(?:.*/)?";
        i += 2;
      } else {
        source += ".*";
        i += 1;
      }
    } else if (c === "*") {
      source += "[^/]*";
    } else {
      source += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
};

/** stryker.config.json の `mutate`（`!` で始まるものは除外）にパスが入るか。 */
export const inMutate = (patterns, path) => {
  let included = false;
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) {
      if (globToRegExp(pattern.slice(1)).test(path)) return false;
    } else if (globToRegExp(pattern).test(path)) {
      included = true;
    }
  }
  return included;
};

/** 実行する範囲を決めない（ほかに何があってもフル run にする）変更か。 */
const IGNORED_DIRS = ["scripts/", ".github/"];

/**
 * 変更の一覧から判定する。`changes` は `{ status, path }`（status は git の A/M/D）。
 * `readPackage(side)` は `"base"` / `"head"` の package.json を返し、`exists(path)` は head にそのファイルが
 * あるかを返す（テストでは差し替える）。
 */
export const select = (changes, { patterns, readPackage, exists }) => {
  const targets = new Set();
  for (const { status, path } of changes) {
    if (isNonCode(path) || IGNORED_DIRS.some((dir) => path.startsWith(dir))) {
      continue;
    }
    if (path === "package.json") {
      if (isVersionOnlyChange(readPackage("base"), readPackage("head"))) {
        continue;
      }
      return {
        mode: "full",
        reason: "package.json に version 以外の変更がある",
      };
    }
    if (path.startsWith("src/") && status !== "D") {
      const isTest = path.endsWith(".test.ts");
      const implementation = isTest
        ? `${path.slice(0, -".test.ts".length)}.ts`
        : path;
      // 隣のテストから引いた実装は、実在するときだけ（パターンに合っても、無ければ何も検査しない）。
      if (
        inMutate(patterns, implementation) &&
        (!isTest || exists(implementation))
      ) {
        targets.add(implementation);
        continue;
      }
    }
    return {
      mode: "full",
      reason: `ファイル単位に絞れない変更がある: ${path}`,
    };
  }
  if (targets.size === 0) {
    return { mode: "skip", reason: "ミューテーションの対象になる変更が無い" };
  }
  const list = [...targets].sort();
  return {
    mode: "subset",
    targets: list,
    reason: `変更したファイルだけを検査する: ${list.join(", ")}`,
  };
};

/** git と stryker.config.json を読んで判定する。失敗したらフル run に倒す。 */
export const detect = (base, head, git, readConfig) => {
  try {
    const changes = git(["diff", "--name-status", "--no-renames", base, head])
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => {
        const [status, path] = line.split("\t");
        return { status, path };
      });
    const { mutate } = JSON.parse(readConfig());
    if (!Array.isArray(mutate) || mutate.length === 0) {
      throw new Error("stryker.config.json に mutate が無い");
    }
    const refs = { base, head };
    return select(changes, {
      patterns: mutate,
      readPackage: (side) => git(["show", `${refs[side]}:package.json`]),
      exists: (path) => {
        try {
          git(["cat-file", "-e", `${head}:${path}`]);
          return true;
        } catch {
          return false;
        }
      },
    });
  } catch (error) {
    return {
      mode: "full",
      // ワークフローの `::warning::` は 1 行しか出ないので、改行を詰める。
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
  const readConfig = () => git(["show", `${head}:stryker.config.json`]);
  const result =
    base && head
      ? detect(base, head, git, readConfig)
      : {
          mode: "full",
          reason: "引数が足りない（base と head を渡す）",
          failed: true,
        };
  if (result.failed) console.error(`::warning::${result.reason}`);
  else console.error(result.reason);
  console.log(`mode=${result.mode}`);
  if (result.mode === "subset")
    console.log(`targets=${result.targets.join(",")}`);
}
