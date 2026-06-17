#!/usr/bin/env bash
# 品質ゲートを順に実行し、Markdown 表で結果を出力する。
# fail-fast しない（1 つ落ちても全ゲートを回す＝レビューは全体像を取りたい）。
# 出力はそのままレビュー報告の「品質ゲート」節に貼れる形にしている。
#
# 使い方:  bash .claude/skills/project-review/scripts/gates.sh
# リポジトリのルート（package.json のある場所）で実行すること。

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT" || { echo "cannot cd to repo root: $ROOT"; exit 2; }

# gate 名 -> 実行コマンド。test:coverage は test を内包するので test 単独は回さない。
GATES=(
  "typecheck|pnpm -s typecheck"
  "lint:ts|pnpm -s lint:ts"
  "lint:md|pnpm -s lint:md"
  "format:check|pnpm -s format:check"
  "test:coverage|pnpm -s test:coverage"
  "build|pnpm -s build"
)

declare -a NAMES RESULTS NOTES
COVERAGE_LINE=""
TESTS_LINE=""

for entry in "${GATES[@]}"; do
  name="${entry%%|*}"
  cmd="${entry#*|}"
  out="$(eval "$cmd" 2>&1)"
  code=$?
  if [ $code -eq 0 ]; then
    res="✅ pass"
  else
    res="❌ FAIL ($code)"
  fi
  note=""
  if [ "$name" = "test:coverage" ]; then
    TESTS_LINE="$(printf '%s\n' "$out" | grep -E '^[[:space:]]*Tests[[:space:]]' | head -1 | sed 's/^[[:space:]]*//')"
    COVERAGE_LINE="$(printf '%s\n' "$out" | grep -E '^All files' | head -1)"
    [ -n "$TESTS_LINE" ] && note="$TESTS_LINE"
  fi
  NAMES+=("$name"); RESULTS+=("$res"); NOTES+=("$note")
done

echo "### 品質ゲート（$(date '+%Y-%m-%d %H:%M') 実測）"
echo
echo "| ゲート | 結果 | 備考 |"
echo "|---|---|---|"
for i in "${!NAMES[@]}"; do
  echo "| \`${NAMES[$i]}\` | ${RESULTS[$i]} | ${NOTES[$i]} |"
done
echo
if [ -n "$COVERAGE_LINE" ]; then
  echo "カバレッジ: \`${COVERAGE_LINE}\`"
fi
