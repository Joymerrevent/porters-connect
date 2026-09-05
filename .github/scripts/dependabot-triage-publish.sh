#!/usr/bin/env bash
# Claude が書いたレポートを検証し、追跡 Issue に反映する。
#
# なぜ LLM にやらせないか: 「雛形どおりか確かめて、既存 Issue があれば上書き、無ければ作る」は
# 判断を含まない決定的な処理で、論点2（マージ工程に LLM を入れない）と同じ理由でここも外す。
# 外すと 3 つ良くなる:
#   - エージェントループが 2 ターン短くなる（毎ターン全文脈を再送しているので効く）
#   - Issue への書き込み権限を Claude と同じ job に置かずに済む（このスクリプトは
#     issues: write を持つ別 job で走り、Claude 側の job は issues: read しか持たない）
#   - **投稿が確実になる**。Claude が途中で失敗しても、レポートさえ書けていれば投稿できる
#
# 検証は投稿の**前**に行う。後に回すと、崩れたレポートが一度 Issue に出てしまう。
# 検証するのは見出しの構造だけでなく、**次回の実行要否に使う機械可読行**も含む
# （検証しない行は、読めなくなったときに静かに機能を失う）。
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# 機械可読行の定義は gate と共有する（読む側と検証する側で形がズレないように）。
# shellcheck source=.github/scripts/dependabot-report-format.sh
. "${HERE}/dependabot-report-format.sh"

REPORT="${REPORT_FILE:-triage-report.md}"
TEMPLATE="${TEMPLATE_FILE:-.claude/skills/dependabot-merge/templates/report.md}"
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
#
# 雛形を読めない（移動・改名された）と grep は 0 行を返し、while が 1 度も回らずに
# **構造検証が丸ごと無効化される**。しかもスクリプトはそのまま「所定の形式です」と
# 出力して投稿へ進む＝検証したと嘘をつく。空を「問題なし」と読まないよう、
# 見出しが 1 つも取れなかった時点で落とす。
template_headings=$(grep -E '^## ' "$TEMPLATE" 2> /dev/null)
if [ -z "$template_headings" ]; then
  fail "雛形 ${TEMPLATE} から見出しを読めません（移動・改名された可能性）。構造を検証できないので投稿しません"
  problems=1
else
  while IFS= read -r heading; do
    grep -qF "$heading" "$REPORT" || {
      fail "見出しが欠落しています: ${heading}"
      problems=1
    }
  done <<EOF
${template_headings}
EOF
fi

# 雛形の埋め方指示（HTML コメント）を消し忘れていないか。
if grep -qF '<!--' "$REPORT"; then
  fail "雛形の HTML コメントが本文に残っています"
  problems=1
fi

# 機械が読む 3 行。ここが崩れると、投稿は通るのに次の実行が壊れる（静かな故障）ので、
# gate が読むのと同じ定義で、投稿の前に落とす。
#
# **ちょうど 1 本**を要求する。0 本なら次の実行が壊れるのは当然として、2 本以上も許さない —
# 読む側（gate / merge）はどれも 1 本目しか見ないので、2 本目以降は黙って無視される。
# レポートに 2 行並んでいるのに片方しか実行されない状態は、読んだ人の理解と食い違う。
require_one_line() {
  local found
  found=$(grep -cE "$1" "$REPORT")
  case "$found" in
    1) return 0 ;;
    0) fail "$2" ;;
    *) fail "${3}が ${found} 行あります。機械が読むのは 1 本目だけで、残りは黙って無視されます" ;;
  esac
  problems=1
}
require_one_line "$REPORT_TIMESTAMP_RE" \
  "検査時刻の行がありません（\`- 検査時刻: 2026-01-02T03:04:05Z\` の形。次回の再判定間隔の判断に使います）" \
  "検査時刻の行"
require_one_line "$REPORT_FINGERPRINT_RE" \
  "判定の指紋の行がありません（\`- 判定の指紋: <16 桁の 16 進>\` の形。次回の実行要否の判断に使います）" \
  "判定の指紋の行"
require_one_line "$REPORT_MERGE_PLAN_RE" \
  "取り込み対象の行がありません（\`- 取り込み対象: #222 → #221\` または \`- 取り込み対象: なし\`。/merge がこの行だけを読みます）" \
  "取り込み対象の行"

# 検査時刻を実時刻と突き合わせる。指紋と head SHA は gate が渡した事実と照合しているのに、
# ここだけ「形が正しい」で通すと、機械が読む 3 行のうち 1 行だけが自己申告のまま残る。
# 未来の時刻を書かれると gate の age_days が負になり、3 日ルール（指紋では捉えられない
# cooldown 熟成の取りこぼしを防ぐ唯一の安全網）が無言で永久に効かなくなる。
report_at=$(grep -m1 -E "$REPORT_TIMESTAMP_RE" "$REPORT" | grep -oE '[0-9T:-]+Z')
if [ -n "$report_at" ]; then
  at_epoch=$(to_epoch "$report_at")
  now_epoch=$(date -u +%s)
  if [ "$at_epoch" -le 0 ]; then
    fail "検査時刻 ${report_at} を解釈できません"
    problems=1
  elif [ "$at_epoch" -gt $((now_epoch + 600)) ]; then
    fail "検査時刻 ${report_at} が未来です。このまま投稿すると次回以降の再判定が無効になります"
    problems=1
  elif [ "$at_epoch" -lt $((now_epoch - 86400)) ]; then
    fail "検査時刻 ${report_at} が古すぎます（1 日以上前）。この実行で書かれた値ではありません"
    problems=1
  fi
fi

# 指紋が期待どおりか。ここがずれると次回の実行要否の判定が壊れる。
if [ -n "$EXPECTED_FINGERPRINT" ]; then
  grep -qE "^- 判定の指紋: \`?${EXPECTED_FINGERPRINT}\`?$" "$REPORT" || {
    fail "判定の指紋が期待値 ${EXPECTED_FINGERPRINT} と一致しません"
    problems=1
  }
fi

# 「取り込み対象」に挙がった PR が、判定表にも現れているか。判定表に無い番号を
# 取り込み対象に書くのは、レポート内部の矛盾（人が読んで承認できない）。
while read -r ref; do
  [ -z "$ref" ] && continue
  grep -qF "$ref" <(grep -vE "$REPORT_MERGE_PLAN_RE" "$REPORT") || {
    fail "取り込み対象の ${ref} が本文の他の場所に出てきません（判定表と食い違っています）"
    problems=1
  }
done < <(grep -E "$REPORT_MERGE_PLAN_RE" "$REPORT" | grep -oE '#[0-9]+')

# 「取り込み対象」に書かれた head SHA が、gate が見た事実と一致するか。
# 書き写した値を検証せずに信じると、取り込み時の同一性チェックが自己申告になる。
plan_refs=$(grep -E "$REPORT_MERGE_PLAN_RE" "$REPORT" | grep -oE '#[0-9]+@[0-9a-f]{7,40}' | tr -d '#')

# 事実そのものが取れていない（gate が PR 一覧を取れなかった）のに承認行に PR が
# 並んでいたら投稿しない。書かれた SHA を誰も検証できていない状態で「承認済み」の
# レポートを出すことになり、取り込み時に必ず失敗する分だけ人の時間を捨てる。
if [ -n "$plan_refs" ] && [ -z "${EXPECTED_PR_HEADS:-}" ]; then
  fail "取り込み対象に PR が並んでいますが、突き合わせる事実（PR の head SHA）が渡っていません"
  problems=1
fi

# 同じ PR を 2 回書いたレポートを弾く。SHA まで同じだと突き合わせも素通りし、
# merge 側は 2 回処理して 2 回目に「open ではありません」で中断する＝レポートの
# 記述と実行結果が食い違う。
dup=$(printf '%s\n' "$plan_refs" | grep -E '@' | cut -d@ -f1 | sort | uniq -d | tr '\n' ' ')
if [ -n "${dup// /}" ]; then
  fail "取り込み対象に同じ PR が複数あります: ${dup}"
  problems=1
fi

if [ -n "${EXPECTED_PR_HEADS:-}" ]; then
  while read -r pair; do
    [ -z "$pair" ] && continue
    num="${pair%@*}"
    sha="${pair#*@}"
    expected=$(printf '%s' "$EXPECTED_PR_HEADS" | tr ';' '\n' | awk -F= -v n="$num" '$1 == n {print $2}')
    if [ -z "$expected" ]; then
      fail "取り込み対象の #${num} は open な dependabot PR の一覧にありません"
      problems=1
    else
      case "$expected" in
        "$sha"*) : ;;
        *)
          fail "取り込み対象 #${num} の head SHA が事実と違います（レポート: ${sha} / 実際: ${expected}）"
          problems=1
          ;;
      esac
    fi
  done < <(printf '%s\n' "$plan_refs")
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

# ラベルは追跡 Issue の同定に使う（第三者は付けられない＝なりすましを弾ける）。
# 既にあれば失敗するので握りつぶす。無いまま create すると下で明示的に落ちる。
gh label create "$DEPENDABOT_ISSUE_LABEL" \
  --color ededed --description "Dependabot 判定レポート（ワークフローが自動更新）" > /dev/null 2>&1 || true

# `--search` は検索インデックスの遅延で取りこぼすので、一覧から選ぶ。
# タイトルだけで選ばないのは、public リポジトリでは誰でも同名 Issue を立てられるため。
num=$(gh issue list --state open --label "$DEPENDABOT_ISSUE_LABEL" --limit 100 --json number,title,author \
  -q "[.[] | ${DEPENDABOT_ISSUE_FILTER}] | .[0].number // empty" 2> /dev/null)

if [ -n "$num" ]; then
  gh issue edit "$num" --body-file "$REPORT" > /dev/null || {
    fail "Issue #${num} の更新に失敗しました"
    exit 1
  }
  echo "追跡 Issue #${num} を更新しました。"
else
  url=$(gh issue create \
    --title "$DEPENDABOT_ISSUE_TITLE" \
    --label "$DEPENDABOT_ISSUE_LABEL" \
    --body-file "$REPORT") || {
    fail "Issue の作成に失敗しました"
    exit 1
  }
  echo "追跡 Issue を作成しました: ${url}"
fi
