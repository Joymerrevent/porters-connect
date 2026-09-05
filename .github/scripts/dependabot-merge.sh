#!/usr/bin/env bash
# 判定レポート Issue の /merge を受けて、依存更新 PR を 1 件ずつ取り込む。
#
# 判断はしない。Issue の判定表が「通してよい」と言っている前提で、機械的に確かめられる
# 事実だけを再検証してから触る。Issue は古くなりうる（投稿後に CI が再実行される、
# develop が動く、PR が閉じられる）ので、投稿時点の状態を信用しない。
#
# **対象はレポートの「取り込み対象」行から取る**（番号を明示された場合はそちら）。
# open な dependabot PR を全部拾わないのは、レポートが「見送り」と判定した PR まで
# 巻き込むため — 判定表を読んだ人の決定はその 1 行に現れているので、そこだけを実行する。
#
# 1 件でも前提が外れたら、そこで中断して残りには手を付けない。続行すると、外れた前提の
# 上に次のマージを積むことになる＝壊れたときに被害が広がる。
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# 「取り込み対象」行の形は gate / publish と共有（publish が投稿前に検証している）。
# shellcheck source=.github/scripts/dependabot-report-format.sh
. "${HERE}/dependabot-report-format.sh"

RESULT="${RESULT_FILE:-result.md}"
: > "$RESULT"

# 変更を許すファイル。依存更新 PR がこれ以外を触っていたら、それは依存更新ではない。
ALLOWED_FILES='^(pnpm-lock\.yaml|package\.json|\.github/workflows/[^/]+\.ya?ml)$'
# 1 件あたり CI が緑になるのを待つ上限。update-branch 後の再実行を見込む。
WAIT_SECONDS="${WAIT_SECONDS:-1500}"
# 全体の上限。件数×WAIT_SECONDS が job の timeout-minutes を超えると、結果を報告する前に
# job ごと殺される（何が起きたか Issue に残らない）。自分で先に止まって報告する。
OVERALL_BUDGET="${OVERALL_BUDGET:-2700}"
# DRY_RUN=1 で検証だけ行い、update-branch もマージもしない。ローカルで通しの
# リハーサルができるようにするため（手順を本番で初めて動かさない）。
DRY_RUN="${DRY_RUN:-0}"

started=$(date +%s)

say() { printf '%s\n' "$*" >> "$RESULT"; }
log() { printf '%s\n' "$*" >&2; }

# ---- 対象 PR を決める ---------------------------------------------------------

# コメント 1 行目から番号を拾う。`/merge`, `/merge 222`, `/merge #222, #221` を許す。
# CR を落とすのは、コメント本文が CRLF で届くため（2 行目があると 1 行目の末尾に CR が
# 残り、`222\r` が数字として読めずに弾かれる — 見た目が正しいので原因が分からない）。
# glob を切るのは、この後の単語分割で `/merge *` がファイル名に展開されないようにするため。
set -f
args=$(printf '%s' "${COMMENT_BODY:-}" | head -1 | tr -d '\r' | sed -E 's#^[[:space:]]*/merge##' | tr -d '#,')

# レポートの「取り込み対象」行。番号を明示された場合も、判定時点の head SHA は
# ここから引くので先に読む（節の散文にある番号は拾わない）。
plan_line=$(printf '%s' "${ISSUE_BODY:-}" | tr -d '\r' | grep -m1 -E "$REPORT_MERGE_PLAN_RE")
plan_nums=()
plan_shas=()
while read -r pair; do
  [ -z "$pair" ] && continue
  plan_nums+=("${pair%@*}")
  plan_shas+=("${pair#*@}")
done < <(printf '%s' "$plan_line" | grep -oE '#[0-9]+@[0-9a-f]{7,40}' | tr -d '#')

# 番号 → 判定時点の head SHA（レポートに無ければ空）。連想配列を使わないのは
# bash 3.2（macOS 既定）でも DRY_RUN のリハーサルができるようにするため。
judged_head_of() {
  local i
  [ ${#plan_nums[@]} -eq 0 ] && return
  for i in "${!plan_nums[@]}"; do
    if [ "${plan_nums[$i]}" = "$1" ]; then
      printf '%s' "${plan_shas[$i]}"
      return
    fi
  done
}

targets=()
source_of_targets=""
if [ -n "${args//[[:space:]]/}" ]; then
  for t in $args; do
    case "$t" in
      '' | *[!0-9]*)
        say "❌ 番号として読めない引数があります: \`$t\`"
        say ""
        say "使い方: \`/merge\`（レポートの取り込み対象）または \`/merge 222 221\`（指定した順）"
        exit 1
        ;;
      *) targets+=("$t") ;;
    esac
  done
  source_of_targets="コメントで指定された順"
else
  # 番号の指定が無ければ、レポートの「取り込み対象」行**だけ**を読む。
  # 節の散文（「#223 は見送り」等）は拾わない＝見送った PR を巻き込まない。
  if [ -z "$plan_line" ]; then
    say "❌ レポートに \`- 取り込み対象:\` の行が見つかりません（形式が古い可能性があります）。"
    say ""
    say "取り込む PR を明示してください: \`/merge 222 221\`"
    exit 1
  fi
  if printf '%s' "$plan_line" | grep -qF 'なし'; then
    say "レポートの取り込み対象は「なし」です。マージするものがありません。"
    exit 0
  fi
  while read -r t; do
    [ -n "$t" ] && targets+=("$t")
  done < <(printf '%s' "$plan_line" | grep -oE '#[0-9]+' | tr -d '#')
  source_of_targets="レポートの「取り込み対象」行"
fi
set +f

if [ ${#targets[@]} -eq 0 ]; then
  say "取り込む PR がありません。"
  exit 0
fi

# 同じ PR が 2 回並んでいたら弾く。1 回目でマージした後、2 回目は「open ではありません」で
# 中断するので、**依頼どおり全部終わっているのに失敗として報告される**。publish は同じ理由で
# レポート側の重複を既に弾いているが（dependabot-triage-publish.sh の「同じ PR を 2 回書いた
# レポート」）、コメント側（`/merge 222 222`）には守りが無かった。同じ入力に守りの有無が
# 分かれていたので揃える。
dup=$(printf '%s\n' "${targets[@]}" | sort | uniq -d | sed 's/^/#/' | tr '\n' ' ')
if [ -n "${dup// /}" ]; then
  say "❌ 同じ PR が複数回指定されています: ${dup}"
  say ""
  say "使い方: \`/merge\`（レポートの取り込み対象）または \`/merge 222 221\`（指定した順）"
  exit 1
fi

say "対象: $(printf '#%s ' "${targets[@]}")"
say "（${source_of_targets}）"
say ""

# ---- CI が緑になるまで待つ ----------------------------------------------------

wait_green() {
  local n="$1" deadline budget_end state head runs failed pending finished
  deadline=$(($(date +%s) + WAIT_SECONDS))
  budget_end=$((started + OVERALL_BUDGET))
  [ "$deadline" -gt "$budget_end" ] && deadline="$budget_end"
  while :; do
    # 待機ループの API 呼び出しだけは stderr を捨てる（20 秒ごとの一時エラーでログが
    # 埋まると、本当の失敗理由が見えなくなる）。一発勝負の操作は下で stderr を残す。
    head=$(gh api "repos/$REPO/pulls/$n" -q .head.sha 2> /dev/null)
    runs=$(gh api "repos/$REPO/commits/$head/check-runs" --paginate \
      -q '.check_runs[] | "\(.name)=\(.conclusion // "pending")"' 2> /dev/null)
    # 失敗を先に見る。mergeable_state は「失敗」も「実行中」も blocked になるため、
    # これが無いと落ちている CI を上限まで待ち続けることになる。
    failed=$(printf '%s\n' "$runs" | grep -E '=' | grep -vE '=(success|neutral|skipped|pending)$' | cut -d= -f1 | tr '\n' ' ')
    if [ -n "${failed// /}" ]; then
      say "  ❌ CI が失敗しています: ${failed}"
      return 1
    fi
    pending=$(printf '%s\n' "$runs" | grep -cE '=pending$')
    finished=$(printf '%s\n' "$runs" | grep -E '=' | grep -cvE '=pending$')
    state=$(gh api "repos/$REPO/pulls/$n" -q .mergeable_state 2> /dev/null)
    case "$state" in
      clean)
        # clean だけを根拠にしない。mergeable_state が見るのは**必須チェックだけ**で、
        # 必須の設定が変われば（設定は変わりうる＝ADR-0065 の前提そのもの）CI が
        # 終わる前でも・1 つも走っていなくても clean になる。「全部の結論が出ていて、
        # 少なくとも 1 つ結果がある」まで待てば、その設定に依存せず緑を確かめられる。
        if [ "$pending" -eq 0 ] && [ "$finished" -gt 0 ]; then
          return 0
        fi
        ;;
      dirty)
        say "  ❌ コンフリクトしています"
        return 1
        ;;
      # blocked（必須チェックが未完了）/ unknown（GitHub が計算中）/ unstable（必須外の
      # チェックが未完了。失敗なら上の failed で既に抜けている）/ behind は待つ。
      *) : ;;
    esac
    if [ "$(date +%s)" -ge "$deadline" ]; then
      # どちらの上限に当たったかを書き分ける。理由が違えば次の手も違う
      # （この 1 件の CI が遅いのか、一度に取り込みすぎなのか）。
      if [ "$deadline" -eq "$budget_end" ]; then
        say "  ❌ 全体の持ち時間 $((OVERALL_BUDGET / 60)) 分を使い切りました（mergeable_state=${state} / 未完了 ${pending} 件 / 完了 ${finished} 件）"
      else
        say "  ❌ CI が $((WAIT_SECONDS / 60)) 分以内に緑になりませんでした（mergeable_state=${state} / 未完了 ${pending} 件 / 完了 ${finished} 件）"
      fi
      return 1
    fi
    log "#$n: state=${state} 待機中…"
    sleep 20
  done
}

# ---- 1 件を検証してマージする -------------------------------------------------

merge_one() {
  local n="$1" info="$2" author base state head files bad judged added
  author=$(printf '%s' "$info" | jq -r .user.login)
  base=$(printf '%s' "$info" | jq -r .base.ref)
  state=$(printf '%s' "$info" | jq -r .state)
  head=$(printf '%s' "$info" | jq -r .head.sha)

  # Issue の記述ではなく、いま API が返す事実で判断する。
  [ "$state" = open ] || {
    say "  ❌ open ではありません（${state}）"
    return 1
  }
  [ "$author" = "dependabot[bot]" ] || {
    say "  ❌ 作者が dependabot[bot] ではありません（${author}）"
    return 1
  }
  [ "$base" = develop ] || {
    say "  ❌ base が develop ではありません（${base}）"
    return 1
  }

  # 取得に失敗したときに空リスト＝「許可外のファイルなし」と読まないこと。
  # PR は必ず 1 つ以上ファイルを変えるので、空なら事実が取れていない＝緑に見せない。
  files=$(gh api "repos/$REPO/pulls/$n/files" --paginate -q '.[].filename')
  [ -n "$files" ] || {
    say "  ❌ 変更ファイル一覧を取得できませんでした（緑と見なさず中断します）"
    return 1
  }
  bad=$(printf '%s\n' "$files" | grep -vE "$ALLOWED_FILES" | tr '\n' ' ')
  [ -z "${bad// /}" ] || {
    say "  ❌ 依存更新以外のファイルを変更しています: ${bad}"
    return 1
  }

  # 判定したときと同じコミットか。承認は「その PR」ではなく「その PR のその
  # コミット」に対して出ているので、force-push で中身が入れ替わっていたら取り込まない。
  # update-branch は develop を取り込む merge なので、祖先関係は保たれる（＝通る）。
  judged=$(judged_head_of "$n")
  if [ -n "$judged" ]; then
    if ! git merge-base --is-ancestor "$judged" "$head" 2> /dev/null; then
      say "  ❌ 判定した時点のコミット ${judged} がこの PR の履歴にありません"
      say "     （force-push で中身が入れ替わった可能性）。判定をやり直してください"
      say "     — Actions の Dependabot Triage を手動実行すると新しいレポートが出ます"
      return 1
    fi
    # 祖先であることは「中身が入れ替わっていない」までしか言わない。判定の**後に**
    # 積まれたコミットは祖先関係を壊さないので、別に見る必要がある。
    # --first-parent で PR 自身の線だけを辿り、--no-merges で update-branch の
    # マージを除く（実測: dependabot PR に積まれる 2 個目は常にこのマージ）。
    added=$(git rev-list --no-merges --first-parent "${judged}..${head}" 2> /dev/null | wc -l | tr -d ' ')
    if [ "${added:-0}" -ne 0 ]; then
      say "  ❌ 判定の後に ${added} 件のコミットが積まれています（判定していない変更が入っています）"
      say "     判定をやり直してください — Actions の Dependabot Triage を手動実行すると新しいレポートが出ます"
      return 1
    fi
  else
    say "  ⚠️ 判定時点のコミットが分からないため、同一性は確認していません"
  fi

  # base が古ければ更新する。GitHub は base の鮮度を要求していない（strict=false）が、
  # 更新しないと「develop を取り込んだ後のロックファイル」に対して CI が一度も走らない。
  # ロックファイルは機械的に解決すると静かに壊れるので、ここは CI に検証させる。
  if ! git merge-base --is-ancestor origin/develop "$head" 2> /dev/null; then
    if [ "$DRY_RUN" = 1 ]; then
      say "  ↻ base 更新が必要です（dry-run のため実行しません）"
      say "  ✅ 検証は通過しました（dry-run のためマージしません）"
      return 0
    fi
    if gh api -X PUT "repos/$REPO/pulls/$n/update-branch" -f expected_head_sha="$head" --silent; then
      say "  ↻ base を develop の最新に更新しました（CI 再実行を待ちます）"
      sleep 15
    else
      say "  ❌ update-branch に失敗しました（head が動いた可能性があります。詳細はログ）"
      return 1
    fi
  fi

  wait_green "$n" || return 1

  if [ "$DRY_RUN" = 1 ]; then
    say "  ✅ 検証は通過しました（dry-run のためマージしません）"
    return 0
  fi

  if gh pr merge "$n" --squash --delete-branch; then
    say "  ✅ マージしました"
    git fetch --prune --quiet origin 2> /dev/null
    return 0
  fi
  say "  ❌ マージに失敗しました（詳細はログ）"
  return 1
}

# ---- 実行 ---------------------------------------------------------------------

merged=0
failed_at=""
out_of_time=""
for i in "${!targets[@]}"; do
  n="${targets[$i]}"
  # 残りに手を付ける前に全体の持ち時間を見る。ここで止まれば結果を Issue に返せる。
  if [ "$(($(date +%s) - started))" -ge "$OVERALL_BUDGET" ]; then
    out_of_time=1
    remaining=("${targets[@]:$i}")
    say ""
    say "⏸ 全体の上限 $((OVERALL_BUDGET / 60)) 分に達したので中断しました。未着手: $(printf '#%s ' "${remaining[@]}")"
    break
  fi
  # gh は失敗時もエラー JSON を stdout に出すので、番号の存在を jq で確かめてから見出しを出す。
  info=$(gh api "repos/$REPO/pulls/$n")
  if ! printf '%s' "$info" | jq -e '.number' > /dev/null 2>&1; then
    say "### #$n"
    say "  ❌ PR 情報を取得できません（存在しない番号の可能性があります）"
    failed_at="$n"
    break
  fi
  say "### #$n $(printf '%s' "$info" | jq -r .title)"
  if merge_one "$n" "$info"; then
    merged=$((merged + 1))
  else
    failed_at="$n"
    # 残りには手を付けない。外れた前提の上に次を積まない。
    remaining=("${targets[@]:$((i + 1))}")
    if [ ${#remaining[@]} -gt 0 ]; then
      say ""
      say "⏸ 中断しました。未着手: $(printf '#%s ' "${remaining[@]}")"
    fi
    break
  fi
  say ""
done

say ""
if [ -n "$failed_at" ]; then
  say "**結果: ${merged} 件マージ、#${failed_at} で中断。**"
  exit 1
fi
if [ -n "$out_of_time" ]; then
  say "**結果: ${merged} 件マージ、時間切れで中断。**"
  exit 1
fi
if [ "$DRY_RUN" = 1 ]; then
  say "**結果: ${merged} 件すべて検証を通過しました（dry-run のためマージしていません）。**"
else
  say "**結果: ${merged} 件すべてマージしました。**"
fi
