#!/usr/bin/env bash
# Claude が書いたレポートを検証し、追跡 Issue に反映する。
#
# なぜ LLM にやらせないか: 「雛形どおりか確かめて、既存 Issue があれば上書き、無ければ作る」は
# 判断を含まない決定的な処理で、論点2（マージ工程に LLM を入れない）と同じ理由でここも外す。
# 外すと 3 つ良くなる:
#   - エージェントループが 2 ターン短くなる（毎ターン全文脈を再送しているので効く）
#   - Claude に gh issue create/edit/list の権限を渡さずに済む
#   - **投稿が確実になる**。Claude が途中で失敗しても、レポートさえ書けていれば投稿できる
#
# 検証は投稿の**前**に行う。後に回すと、崩れたレポートが一度 Issue に出てしまう。
set -uo pipefail

REPORT="${REPORT_FILE:-triage-report.md}"
TEMPLATE="${TEMPLATE_FILE:-.claude/skills/dependabot-merge/templates/report.md}"
ISSUE_TITLE="Dependabot 判定レポート"
EXPECTED_FINGERPRINT="${EXPECTED_FINGERPRINT:-}"

fail() {
  printf '::error::%s\n' "$1" >&2
  return 1
}

# ---- 検証 ---------------------------------------------------------------------

if [ ! -s "$REPORT" ]; then
  fail "レポート ${REPORT} が空か、存在しません（Claude が書けなかった可能性があります）"
  exit 1
fi

problems=0

# 雛形の見出しが揃っているか。見出しは雛形が単一の正なので、そこから取る。
while IFS= read -r heading; do
  grep -qF "$heading" "$REPORT" || {
    fail "見出しが欠落しています: ${heading}"
    problems=1
  }
done < <(grep -E '^## ' "$TEMPLATE")

# 雛形の埋め方指示（HTML コメント）を消し忘れていないか。
if grep -qF '<!--' "$REPORT"; then
  fail "雛形の HTML コメントが本文に残っています"
  problems=1
fi

# 指紋が期待どおりか。ここがずれると次回の実行要否の判定が壊れる。
if [ -n "$EXPECTED_FINGERPRINT" ]; then
  grep -qF "$EXPECTED_FINGERPRINT" "$REPORT" || {
    fail "判定の指紋が期待値 ${EXPECTED_FINGERPRINT} と一致しません"
    problems=1
  }
fi

if [ "$problems" -ne 0 ]; then
  printf '\n--- 検証に失敗したので投稿しません。レポートの内容 ---\n' >&2
  cat "$REPORT" >&2
  exit 1
fi
echo "レポートは所定の形式です。"

# ---- 追跡 Issue に反映 --------------------------------------------------------

if [ "${DRY_RUN:-0}" = 1 ]; then
  echo "dry-run のため投稿しません。"
  exit 0
fi

# `--search` は検索インデックスの遅延で取りこぼすので、一覧から選ぶ。
num=$(gh issue list --state open --limit 100 --json number,title \
  -q "[.[] | select(.title == \"${ISSUE_TITLE}\")] | .[0].number // empty" 2> /dev/null)

if [ -n "$num" ]; then
  gh issue edit "$num" --body-file "$REPORT" > /dev/null || {
    fail "Issue #${num} の更新に失敗しました"
    exit 1
  }
  echo "追跡 Issue #${num} を更新しました。"
else
  url=$(gh issue create --title "$ISSUE_TITLE" --body-file "$REPORT") || {
    fail "Issue の作成に失敗しました"
    exit 1
  }
  echo "追跡 Issue を作成しました: ${url}"
fi
