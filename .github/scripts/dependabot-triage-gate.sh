#!/usr/bin/env bash
# 判定を走らせるべきかを決める。判断材料を集めたうえで、前回のレポートから
# 状況が変わっていなければ Claude を起動しない（同じ判定を毎朝やり直さない）。
#
# 指紋の作り方が肝。triage-facts.txt をそのままハッシュしてはいけない —
# 本文に「（9 日前）」のような経過日数が入っており毎日変わるので、
# 何も変わっていなくても毎回すり抜けてしまう。
# 拾うのは「判定が変わりうる要素」だけ:
#   - open な dependabot PR の集合と head SHA（PR の増減・push で変わる）
#   - head SHA に対する各チェックの結論（CI の再実行で変わる）
#   - base の鮮度（develop が動くと変わる）
#   - cooldown 未達の警告が付いているパッケージ（熟成すると消える）
#
# ただし cooldown の熟成は時間依存で、指紋だけでは完全に捉えきれない
# （major の 14 日境界は triage.sh の 7 日警告では表現できない）。
# そこで「前回から MAX_AGE_DAYS 以上経っていたら指紋が同じでも再判定する」を併用する。
# 取りこぼすくらいなら余分に走らせる＝安全側に倒す。
#
# **迷ったら走らせる**のがこのファイルの原則。前回のレポートが読めない・時刻を解釈できない
# といった「分からない」状態は、抑止ではなく実行に倒す（抑止に倒すと、cooldown の熟成を
# 永久に取りこぼす形で静かに壊れる）。
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# レポートの機械可読行の定義は publish と共有する（形のズレを作らないため）。
# shellcheck source=.github/scripts/dependabot-report-format.sh
. "${HERE}/dependabot-report-format.sh"

FACTS="${FACTS_FILE:-triage-facts.txt}"
MAX_AGE_DAYS="${MAX_AGE_DAYS:-3}"
OUT="${GITHUB_OUTPUT:-/dev/stdout}"

sha256() { if command -v sha256sum > /dev/null 2>&1; then sha256sum; else shasum -a 256; fi; }
emit() { printf '%s=%s\n' "$1" "$2" >> "$OUT"; }

# ISO 8601 を epoch 秒に。読めなければ 0（＝呼び出し側は「分からない」として実行に倒す）。
to_epoch() {
  date -u -d "$1" +%s 2> /dev/null \
    || date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$1" +%s 2> /dev/null \
    || date -u -j -f '%Y-%m-%dT%H:%MZ' "$1" +%s 2> /dev/null \
    || echo 0
}

bash "${HERE}/../../.claude/skills/dependabot-merge/scripts/triage.sh" > "$FACTS" 2>&1 || true
cat "$FACTS"

if grep -q "open な dependabot PR はありません" "$FACTS"; then
  emit has_prs false
  emit should_run false
  emit reason "open な dependabot PR がありません"
  exit 0
fi
emit has_prs true

# ---- 指紋を作る ---------------------------------------------------------------

fingerprint=$(
  {
    gh api "repos/$REPO/pulls?state=open&per_page=100" \
      -q '.[] | select(.user.login == "dependabot[bot]") | select(.base.ref == "develop") | "\(.number)\t\(.head.sha)"' 2> /dev/null \
      | sort | while IFS=$'\t' read -r num sha; do
        [ -z "$num" ] && continue
        checks=$(gh api "repos/$REPO/commits/$sha/check-runs" --paginate \
          -q '[.check_runs[] | "\(.name)=\(.conclusion // .status)"] | sort | join(",")' 2> /dev/null)
        if git merge-base --is-ancestor origin/develop "$sha" 2> /dev/null; then
          fresh=fresh
        else
          fresh=stale
        fi
        printf '%s %s %s %s\n' "$num" "$sha" "$fresh" "$checks"
      done
    # cooldown 未達の警告が付いているパッケージ名（熟成すると消える＝指紋が変わる）
    grep '⚠️ cooldown' "$FACTS" | awk '{print $1}' | sort
  } | sha256 | cut -c1-16
)
emit fingerprint "$fingerprint"

# ---- 前回のレポートと比べる ---------------------------------------------------

# 追跡 Issue はラベル＋タイトル＋bot 作者の 3 点で同定する。タイトルだけだと、
# public リポジトリでは第三者が立てた同名 Issue を「前回のレポート」として読みうる。
prev=$(gh issue list --state open --label "$DEPENDABOT_ISSUE_LABEL" --limit 100 --json title,body,author \
  -q "[.[] | ${DEPENDABOT_ISSUE_FILTER}] | .[0].body // empty" 2> /dev/null \
  | tr -d '\r')

if [ -z "$prev" ]; then
  emit should_run true
  emit reason "追跡 Issue がまだありません（初回）"
  exit 0
fi

prev_fp=$(printf '%s\n' "$prev" | grep -m1 -E "$REPORT_FINGERPRINT_RE" | grep -oE '[0-9a-f]{16}')

if [ -z "$prev_fp" ]; then
  emit should_run true
  emit reason "前回のレポートから指紋を読めません（形式が古い）"
  exit 0
fi

if [ "$prev_fp" != "$fingerprint" ]; then
  emit should_run true
  emit reason "状況が変わりました（指紋 ${prev_fp} → ${fingerprint}）"
  exit 0
fi

# 指紋は同じ。ただし cooldown の熟成は時間依存なので、古すぎるレポートは作り直す。
# ここで時刻が読めないと 3 日ルールごと無効化されるため、読めない場合は実行に倒す。
prev_at=$(printf '%s\n' "$prev" | grep -m1 -E "$REPORT_TIMESTAMP_RE" | grep -oE '[0-9T:-]+Z')
if [ -z "$prev_at" ]; then
  emit should_run true
  emit reason "前回のレポートから検査時刻を読めません（形式が古い）"
  exit 0
fi

prev_epoch=$(to_epoch "$prev_at")
if [ "$prev_epoch" -le 0 ]; then
  emit should_run true
  emit reason "前回の検査時刻を解釈できません（${prev_at}）"
  exit 0
fi

age_days=$((($(date -u +%s) - prev_epoch) / 86400))
if [ "$age_days" -ge "$MAX_AGE_DAYS" ]; then
  emit should_run true
  emit reason "指紋は同じですが前回から ${age_days} 日経過しています（cooldown 熟成の取りこぼしを避けるため再判定）"
  exit 0
fi

emit should_run false
emit reason "前回のレポートから状況が変わっていません（指紋 ${fingerprint}）"
