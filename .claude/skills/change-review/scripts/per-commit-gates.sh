#!/usr/bin/env bash
# 各コミットを単独でチェックアウトし、品質ゲートを回して表で返す。
#
# なぜ要るか: このリポジトリは「実装 PR は変更ごとに分割し、各コミット単独で緑になる順序で
# 積む」運用にしている。だが HEAD だけ緑でも、途中のコミットが赤いことは普通に起きる
# （import を足したコミットと、その実体を足したコミットが分かれている等）。目視では守れない
# ので機械で確かめる。bisect や revert が効かなくなるのを防ぐのが目的。
#
# 使い方:
#   bash .claude/skills/change-review/scripts/per-commit-gates.sh
#   bash .claude/skills/change-review/scripts/per-commit-gates.sh main
#   bash .claude/skills/change-review/scripts/per-commit-gates.sh develop -- "pnpm -s check:shell"
#
# 既定の基点は develop（無ければ main）。`--` の後ろに渡したものがゲート（複数可）で、
# 省略時は typecheck / lint / test を回す。build と coverage は遅いので既定から外してある
# （必要なら `-- "pnpm -s typecheck" "pnpm -s build"` のように明示する）。
#
# 長いブランチは二段で回す方が速い。コミットごとに worktree を作り直すので、
# 既定ゲート 3 本 × 数十コミットは素直に時間を食う:
#   1) 軽いゲートで全部を通す        … per-commit-gates.sh develop -- "pnpm -s typecheck"
#   2) 赤が出たコミットだけ見直す    … per-commit-gates.sh <赤いコミット>^ -- "pnpm -s lint" "pnpm -s test"
# 2 回目は `^` を基点にすることでそのコミット 1 件だけが対象になる。
#
# 制約（読まずに信じないこと）:
#   - 作業ツリーの未コミット変更は検査対象外。コミット済みの状態だけを見る。
#   - マージコミットは飛ばす（--no-merges）。
#   - node_modules は現在のチェックアウトのものを symlink して使い回す。よって
#     **依存を変えたコミット（package.json / pnpm-lock.yaml を触るもの）の結果は信用できない**。
#     該当コミットには表に「依存変更」と印を付けるので、そこは worktree で
#     `pnpm install --frozen-lockfile` してから手で確かめること。
#   - そのコミットに存在しないゲート（後から足した `check:shell` など）は ⚠️ 未実行として
#     区別し、赤にはしない。無いゲートを赤と書くと、落ちた理由が事実と違うものになる。

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "${ROOT}" || { echo "cannot cd to repo root: ${ROOT}" >&2; exit 2; }

# pnpm 10 は run の前に依存の整合性を検査することがある。node_modules を symlink で
# 借りている構成では偽陽性になるので明示的に切る。
export PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false

# ---- 引数 -------------------------------------------------------------------

BASE=""
declare -a GATES
GATES=()
SAW_DASHDASH=0

for arg in "$@"; do
  if [ "${SAW_DASHDASH}" -eq 1 ]; then
    GATES+=("${arg}")
  elif [ "${arg}" = "--" ]; then
    SAW_DASHDASH=1
  elif [ -z "${BASE}" ]; then
    BASE="${arg}"
  else
    echo "基点は 1 つだけ指定できます: ${arg}" >&2
    exit 2
  fi
done

if [ -z "${BASE}" ]; then
  if git rev-parse --verify --quiet develop >/dev/null; then
    BASE="develop"
  else
    BASE="main"
  fi
fi

if ! git rev-parse --verify --quiet "${BASE}" >/dev/null; then
  echo "基点が解決できません: ${BASE}" >&2
  exit 2
fi

USING_DEFAULT_GATES=0
if [ "${#GATES[@]}" -eq 0 ]; then
  GATES=("pnpm -s typecheck" "pnpm -s lint" "pnpm -s test")
  USING_DEFAULT_GATES=1
fi

# ---- 対象コミット -----------------------------------------------------------

# 空文字混入を避けるため、改行区切りで読む（bash 3.2 なので mapfile は使わない）。
declare -a SHAS
SHAS=()
while IFS= read -r line; do
  [ -n "${line}" ] && SHAS+=("${line}")
done <<EOF
$(git rev-list --reverse --no-merges "${BASE}..HEAD")
EOF

if [ "${#SHAS[@]}" -eq 0 ]; then
  echo "${BASE}..HEAD に検査対象のコミットがありません。"
  exit 0
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "注意: 未コミットの変更があります。この検査はコミット済みの状態だけを見ます。"
  echo
fi

echo "基点: ${BASE} ／ 対象 ${#SHAS[@]} コミット ／ ゲート: ${GATES[*]}"
echo

# 二段で回す方が速い場面を、待たされる前に知らせる（走らせてから気づくと、
# 数十分ぶんの worktree 作り直しを捨てることになる）。
if [ "${USING_DEFAULT_GATES}" -eq 1 ] && [ "${#SHAS[@]}" -gt 10 ]; then
  echo "注意: ${#SHAS[@]} コミット × 既定ゲート 3 本は時間がかかります。二段で回す方が速い:"
  echo "  1) bash $0 ${BASE} -- \"pnpm -s typecheck\""
  echo "  2) bash $0 <赤いコミット>^ -- \"pnpm -s lint\" \"pnpm -s test\""
  echo
fi

# ---- 実行 -------------------------------------------------------------------

LOGDIR="$(mktemp -d "${TMPDIR:-/tmp}/change-review-logs.XXXXXX")"

# `pnpm -s <script>` 形のゲートが、そのコミットの package.json に在るかを見る。
# ゲートを足す前のコミットを「赤」と記録すると、落ちた理由が事実と違うものになり、
# 表全体が信用できなくなる。判定できない形のゲートは、実行して結果に任せる。
# 判定は**迷ったら実行する**方に倒す。飛ばす方に倒すと、ゲートが走っていないのに
# 「このコミットには無いゲート」という事実と違う理由が表に並び、要約は緑のままになる
# ＝このスクリプトが防ごうとしている「無言で空振りする検査」そのものになる。
gate_available() {
  local wt="$1"
  local gate="$2"
  local rest=""
  local tok=""
  local name=""

  case "${gate}" in
    pnpm\ *) ;;
    *) return 0 ;;
  esac

  # `pnpm` の後ろのフラグを飛ばして最初の語を見る。`run <名前>` なら次の語がスクリプト名、
  # `exec` などの組み込みコマンドならスクリプトではないので、そのまま実行に任せる。
  # 「最後の語をスクリプト名とみなす」だと `pnpm exec markdownlint-cli2` の
  # `markdownlint-cli2` を存在しないスクリプトと誤判定して、ゲートが無言で飛ぶ。
  rest="${gate#pnpm}"
  while :; do
    rest="${rest# }"
    case "${rest}" in
      -*) rest="${rest#* }" ;;
      *) break ;;
    esac
  done
  tok="${rest%% *}"

  case "${tok}" in
    "") return 0 ;;
    run)
      rest="${rest#run}"
      rest="${rest# }"
      name="${rest%% *}"
      [ -z "${name}" ] && return 0
      ;;
    exec | dlx | install | i | add | remove | update | why | ls | list | store | dedupe \
      | link | publish | pack | create | init | env | config | audit | outdated | rebuild \
      | prune | patch | fetch | import | deploy | licenses | setup | node | start | test)
      return 0
      ;;
    *) name="${tok}" ;;
  esac

  node -e 'const p=require(process.argv[1]);process.exit(((p.scripts||{})[process.argv[2]])?0:1)' \
    "${wt}/package.json" "${name}" > /dev/null 2>&1
}

WT=""
cleanup() {
  if [ -n "${WT}" ] && [ -d "${WT}" ]; then
    git worktree remove --force "${WT}" >/dev/null 2>&1 || rm -rf "${WT}"
  fi
  git worktree prune >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

declare -a ROW_SHA ROW_SUBJECT ROW_RESULT ROW_FAILED ROW_NOTE
ROW_SHA=(); ROW_SUBJECT=(); ROW_RESULT=(); ROW_FAILED=(); ROW_NOTE=()
EXIT_CODE=0

for sha in "${SHAS[@]}"; do
  short="$(git rev-parse --short "${sha}")"
  subject="$(git log -1 --format=%s "${sha}" | tr '|' '/')"

  note=""
  if git show --name-only --format="" "${sha}" | grep -qE '^(package\.json|pnpm-lock\.yaml)$'; then
    note="依存変更（要 install・結果は参考値）"
  fi

  WT="$(mktemp -d "${TMPDIR:-/tmp}/change-review-wt.XXXXXX")"
  rm -rf "${WT}"
  if ! git worktree add --detach "${WT}" "${sha}" >/dev/null 2>&1; then
    ROW_SHA+=("${short}"); ROW_SUBJECT+=("${subject}")
    ROW_RESULT+=("⚠️ skip"); ROW_FAILED+=("worktree 作成に失敗"); ROW_NOTE+=("${note}")
    EXIT_CODE=1
    WT=""
    continue
  fi

  # 依存は現在のチェックアウトのものを借りる（pnpm の node_modules 内部の symlink は
  # 相対パスなので、ディレクトリごと張れば解決する）。
  ln -s "${ROOT}/node_modules" "${WT}/node_modules"

  failed=""
  skipped=""
  echo "--- ${short} ${subject}"
  for gate in "${GATES[@]}"; do
    if ! gate_available "${WT}" "${gate}"; then
      printf '    --   %s   このコミットには無いゲート\n' "${gate}"
      if [ -z "${skipped}" ]; then skipped="${gate}"; else skipped="${skipped} / ${gate}"; fi
      continue
    fi
    log="${LOGDIR}/${short}-$(printf '%s' "${gate}" | tr -cs 'A-Za-z0-9' '-').log"
    if ( cd "${WT}" && eval "${gate}" ) >"${log}" 2>&1; then
      printf '    ok   %s\n' "${gate}"
      rm -f "${log}"
    else
      printf '    NG   %s   → %s\n' "${gate}" "${log}"
      if [ -z "${failed}" ]; then failed="${gate}"; else failed="${failed} / ${gate}"; fi
    fi
  done

  git worktree remove --force "${WT}" >/dev/null 2>&1 || rm -rf "${WT}"
  WT=""

  ROW_SHA+=("${short}")
  ROW_SUBJECT+=("${subject}")
  ROW_NOTE+=("${note}")
  if [ -n "${failed}" ]; then
    ROW_RESULT+=("❌")
    ROW_FAILED+=("${failed}")
    EXIT_CODE=1
  elif [ -n "${skipped}" ]; then
    ROW_RESULT+=("⚠️")
    ROW_FAILED+=("未実行: ${skipped}")
  else
    ROW_RESULT+=("✅")
    ROW_FAILED+=("—")
  fi
done

# ---- 出力（そのままレビュー報告に貼れる形） ---------------------------------

echo
echo "| コミット | 件名 | 結果 | 落ちたゲート | 備考 |"
echo "| --- | --- | --- | --- | --- |"
i=0
while [ "${i}" -lt "${#ROW_SHA[@]}" ]; do
  note="${ROW_NOTE[${i}]}"
  [ -z "${note}" ] && note="—"
  printf '| `%s` | %s | %s | %s | %s |\n' \
    "${ROW_SHA[${i}]}" "${ROW_SUBJECT[${i}]}" "${ROW_RESULT[${i}]}" "${ROW_FAILED[${i}]}" "${note}"
  i=$((i + 1))
done

echo
if [ "${EXIT_CODE}" -eq 0 ]; then
  echo "全コミットが単独で緑です（⚠️ の行は、そのコミットに存在しないゲートを飛ばした分）。"
else
  echo "単独で緑にならないコミットがあります。bisect / revert が効かなくなるので、"
  echo "コミットの順序か分割を見直してください。落ちたゲートの出力: ${LOGDIR}"
fi

# 落ちたゲートのログは残す（原因を見るのはこの後の仕事）。緑なら消えている。
rmdir "${LOGDIR}" 2>/dev/null || true

exit "${EXIT_CODE}"
