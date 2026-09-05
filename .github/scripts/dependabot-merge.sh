#!/usr/bin/env bash
# 判定レポート Issue の /merge を受けて、依存更新 PR を 1 件ずつ取り込む。
#
# 判断はしない。Issue の判定表が「通してよい」と言っている前提で、機械的に確かめられる
# 事実だけを再検証してから触る。Issue は古くなりうる（投稿後に CI が再実行される、
# develop が動く、PR が閉じられる）ので、投稿時点の状態を信用しない。
#
# 1 件でも前提が外れたら、そこで中断して残りには手を付けない。続行すると、外れた前提の
# 上に次のマージを積むことになる＝壊れたときに被害が広がる。
set -uo pipefail

RESULT="${RESULT_FILE:-result.md}"
: > "$RESULT"

# 変更を許すファイル。依存更新 PR がこれ以外を触っていたら、それは依存更新ではない。
ALLOWED_FILES='^(pnpm-lock\.yaml|package\.json|\.github/workflows/[^/]+\.ya?ml)$'
# CI が緑になるのを待つ上限。update-branch 後の再実行を見込む。
WAIT_SECONDS=1500
# DRY_RUN=1 で検証だけ行い、update-branch もマージもしない。ローカルで通しの
# リハーサルができるようにするため（手順を本番で初めて動かさない）。
DRY_RUN="${DRY_RUN:-0}"

say() { printf '%s\n' "$*" >> "$RESULT"; }
log() { printf '%s\n' "$*" >&2; }

# ---- 対象 PR を決める ---------------------------------------------------------

# コメント 1 行目から番号を拾う。`/merge`, `/merge 222`, `/merge #222, #221` を許す。
# CR を落とすのは、コメント本文が CRLF で届くため（2 行目があると 1 行目の末尾に CR が
# 残り、`222\r` が数字として読めずに弾かれる — 見た目が正しいので原因が分からない）。
# glob を切るのは、この後の単語分割で `/merge *` がファイル名に展開されないようにするため。
set -f
args=$(printf '%s' "${COMMENT_BODY:-}" | head -1 | tr -d '\r' | sed -E 's#^[[:space:]]*/merge##' | tr -d '#,')

targets=()
if [ -n "${args//[[:space:]]/}" ]; then
  for t in $args; do
    case "$t" in
      '' | *[!0-9]*)
        say "❌ 番号として読めない引数があります: \`$t\`"
        say ""
        say "使い方: \`/merge\`（全件）または \`/merge 222 221\`（指定した順）"
        exit 1
        ;;
      *) targets+=("$t") ;;
    esac
  done
else
  # 指定が無ければ全件。順番は「競合しないものから」＝ロックファイルを触らない PR を先に。
  # 同じ lock を触るもの同士は prod → dev の順（prod は利用者に届くので単独で緑を帰属させる）。
  order=$(mktemp)
  while IFS=$'\t' read -r num title; do
    [ -z "$num" ] && continue
    files=$(gh api "repos/$REPO/pulls/$num/files" --paginate -q '[.[].filename] | join(" ")' 2>/dev/null)
    if printf '%s' "$files" | grep -q 'pnpm-lock\.yaml'; then
      case "$title" in
        *prod-dependencies*) rank=1 ;;
        *dev-dependencies*) rank=2 ;;
        *) rank=3 ;;
      esac
    else
      rank=0
    fi
    printf '%s\t%s\n' "$rank" "$num" >> "$order"
  done < <(gh api "repos/$REPO/pulls?state=open&per_page=100" \
    -q '.[] | select(.user.login == "dependabot[bot]") | select(.base.ref == "develop") | "\(.number)\t\(.title)"' 2>/dev/null)

  while read -r n; do [ -n "$n" ] && targets+=("$n"); done < <(sort -k1,1n -k2,2n "$order" | cut -f2)
fi
set +f

if [ ${#targets[@]} -eq 0 ]; then
  say "open な dependabot PR はありません。マージするものがありません。"
  exit 0
fi

say "対象: $(printf '#%s ' "${targets[@]}")"
say ""

# ---- CI が緑になるまで待つ ----------------------------------------------------

wait_green() {
  local n="$1" deadline state head failed
  deadline=$(($(date +%s) + WAIT_SECONDS))
  while :; do
    head=$(gh api "repos/$REPO/pulls/$n" -q .head.sha 2>/dev/null)
    # 失敗を先に見る。mergeable_state は「失敗」も「実行中」も blocked になるため、
    # これが無いと落ちている CI を上限まで待ち続けることになる。
    failed=$(gh api "repos/$REPO/commits/$head/check-runs" --paginate \
      -q '[.check_runs[] | select(.conclusion != null and .conclusion != "success" and .conclusion != "neutral" and .conclusion != "skipped") | .name] | join(", ")' 2>/dev/null)
    if [ -n "$failed" ]; then
      say "  ❌ CI が失敗しています: $failed"
      return 1
    fi
    state=$(gh api "repos/$REPO/pulls/$n" -q .mergeable_state 2>/dev/null)
    case "$state" in
      clean) return 0 ;; # マージ可能＋必須チェック（ci / stryker）が緑
      dirty)
        say "  ❌ コンフリクトしています"
        return 1
        ;;
      *) : ;; # blocked / unknown / behind → まだ走っている
    esac
    if [ "$(date +%s)" -ge "$deadline" ]; then
      say "  ❌ CI が $((WAIT_SECONDS / 60)) 分以内に緑になりませんでした（mergeable_state=${state}）"
      return 1
    fi
    log "#$n: state=$state 待機中…"
    sleep 20
  done
}

# ---- 1 件を検証してマージする -------------------------------------------------

merge_one() {
  local n="$1" info="$2" author base state head bad
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

  bad=$(gh api "repos/$REPO/pulls/$n/files" --paginate -q '.[].filename' 2>/dev/null \
    | grep -vE "$ALLOWED_FILES" | tr '\n' ' ')
  [ -z "${bad// /}" ] || {
    say "  ❌ 依存更新以外のファイルを変更しています: $bad"
    return 1
  }

  # base が古ければ更新する。GitHub は base の鮮度を要求していない（strict=false）が、
  # 更新しないと「develop を取り込んだ後のロックファイル」に対して CI が一度も走らない。
  # ロックファイルは機械的に解決すると静かに壊れるので、ここは CI に検証させる。
  if ! git merge-base --is-ancestor origin/develop "$head" 2>/dev/null; then
    if [ "$DRY_RUN" = 1 ]; then
      say "  ↻ base 更新が必要です（dry-run のため実行しません）"
      say "  ✅ 検証は通過しました（dry-run のためマージしません）"
      return 0
    fi
    if gh api -X PUT "repos/$REPO/pulls/$n/update-branch" -f expected_head_sha="$head" --silent 2>/dev/null; then
      say "  ↻ base を develop の最新に更新しました（CI 再実行を待ちます）"
      sleep 15
    else
      say "  ❌ update-branch に失敗しました（head が動いた可能性があります）"
      return 1
    fi
  fi

  if [ "$DRY_RUN" = 1 ]; then
    wait_green "$n" || return 1
    say "  ✅ 検証は通過しました（dry-run のためマージしません）"
    return 0
  fi

  wait_green "$n" || return 1

  if gh pr merge "$n" --squash --delete-branch 2>/dev/null; then
    say "  ✅ マージしました"
    git fetch --prune --quiet origin 2>/dev/null
    return 0
  fi
  say "  ❌ マージに失敗しました"
  return 1
}

# ---- 実行 ---------------------------------------------------------------------

merged=0
failed_at=""
for i in "${!targets[@]}"; do
  n="${targets[$i]}"
  # gh は失敗時もエラー JSON を stdout に出すので、番号の存在を jq で確かめてから見出しを出す。
  info=$(gh api "repos/$REPO/pulls/$n" 2>/dev/null)
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
  say "**結果: $merged 件マージ、#$failed_at で中断。**"
  exit 1
fi
if [ "$DRY_RUN" = 1 ]; then
  say "**結果: $merged 件すべて検証を通過しました（dry-run のためマージしていません）。**"
else
  say "**結果: $merged 件すべてマージしました。**"
fi
