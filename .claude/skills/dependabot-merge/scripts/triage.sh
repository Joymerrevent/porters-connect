#!/usr/bin/env bash
# Dependabot PR の判断材料を集める（判定はしない）。
#
# 集めるのは「毎回同じように調べる」機械的な事実だけ — PR の状態・head SHA に対する
# CI 結果・変更ファイル・更新先バージョンの npm 公開日。これらを人手で集めると
# 見落とし（古い CI を見る、消えたブランチを追う）が起きるので、ここで固定する。
#
# 判定（cooldown を満たすか、どの順で入れるか、止めるべきか）は SKILL.md 側の仕事。
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

# リモート追跡ブランチの鮮度を先に揃える。古いままだと消えたブランチを実在扱いして
# しまい、update-branch が 422 を返すまで気づけない。
git fetch --prune --quiet origin 2>/dev/null

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null) || {
  echo "gh の認証に失敗しました。gh auth status を確認してください。" >&2
  exit 1
}

echo "repo: $REPO"
echo "develop: $(git rev-parse --short origin/develop 2>/dev/null || echo '?')"
echo

# cooldown 設定（判定の基準値）を設定ファイルから読み出して見せる。値をこのスクリプトに
# 埋め込まないのは、設定が変わったのに気づかないのが一番危ないため。
echo "--- cooldown 設定（.github/dependabot.yml）---"
if [ -f .github/dependabot.yml ]; then
  grep -E "package-ecosystem|days:" .github/dependabot.yml | sed 's/^[[:space:]]*/  /'
else
  echo "  .github/dependabot.yml が見つかりません"
fi
echo

# base を develop に絞るのは、このスキルの対象が develop 向けの依存更新 PR だけだから
# （main 向けはリリース PR ＝ docs/release-runbook.md の管轄）。定期実行側の指紋も
# 同じ条件で PR を数えるので、ここを変えると両者の対象集合がずれる。
PRS=$(gh api "repos/$REPO/pulls?state=open&per_page=100" \
  -q '.[] | select(.user.login == "dependabot[bot]") | select(.base.ref == "develop") | "\(.number)\t\(.head.sha)\t\(.head.ref)\t\(.title)"' 2>/dev/null)

if [ -z "$PRS" ]; then
  echo "open な dependabot PR はありません。"
  exit 0
fi

while IFS=$'\t' read -r num sha ref title; do
  [ -z "$num" ] && continue
  echo "════════════════════════════════════════════════════════"
  echo "#$num  $title"
  echo "  head: ${sha:0:7}  branch: $ref"

  # mergeable_state は GitHub 側が非同期に計算するため、初回は unknown が返る。
  # 一度読んで unknown なら少し待って読み直す。
  state=$(gh api "repos/$REPO/pulls/$num" -q '.mergeable_state' 2>/dev/null)
  if [ "$state" = "unknown" ] || [ -z "$state" ]; then
    sleep 3
    state=$(gh api "repos/$REPO/pulls/$num" -q '.mergeable_state' 2>/dev/null)
  fi
  echo "  mergeable_state: ${state:-?}"

  # base の鮮度。develop が head の祖先でなければ update-branch が要る。
  if git merge-base --is-ancestor origin/develop "$sha" 2>/dev/null; then
    echo "  base: 最新（develop 取り込み済み）"
  else
    echo "  base: ⚠️ 古い（update-branch が必要）"
  fi

  # CI は必ず head SHA に対して見る。PR 番号で引くと更新前の結果を拾いうる。
  echo -n "  CI: "
  gh api "repos/$REPO/commits/$sha/check-runs" --paginate \
    -q '[.check_runs[] | "\(.conclusion // .status)"] | group_by(.) | map("\(.[0])×\(length)") | join(" ")' 2>/dev/null \
    || echo "取得失敗"

  failed=$(gh api "repos/$REPO/commits/$sha/check-runs" --paginate \
    -q '[.check_runs[] | select(.conclusion != null and .conclusion != "success" and .conclusion != "neutral" and .conclusion != "skipped") | .name] | join(", ")' 2>/dev/null)
  [ -n "$failed" ] && echo "  ⚠️ 失敗/未成功: $failed"

  echo -n "  files: "
  gh api "repos/$REPO/pulls/$num/files" --paginate -q '[.[].filename] | join(", ")' 2>/dev/null || echo "?"

  # 更新先バージョンの公開日。cooldown を満たすかは SKILL.md の基準と突き合わせて判断する。
  echo "  更新内容と npm 公開日:"
  gh api "repos/$REPO/pulls/$num" -q .body 2>/dev/null | python3 -u -c '
import re, subprocess, sys, json, datetime
body = sys.stdin.read()
# dependabot の本文にある表 `| [pkg](url) | `from` | `to` |` を拾う。
# 本文の形は 2 種類ある。複数更新は表、単一更新は "Updates `pkg` from A to B" の文。
# 表を先に見て、無ければ文から拾う（同じパッケージが複数回現れるので重複を落とす）。
rows = re.findall(r"^\|\s*\[?`?([@\w./\-]+)`?\]?[^|]*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|", body, re.M)
if not rows:
    seen = set()
    for m in re.finditer(r"(?:Bumps|Updates)\s+\[?`?([@\w./\-]+)`?\]?[^\s]*\s+from\s+([\w.\-]+)\s+to\s+([\w.\-]+)", body):
        if m.group(1) not in seen:
            seen.add(m.group(1)); rows.append(m.groups())
if not rows:
    print("    （本文から更新表を読めませんでした。PR 本文を直接確認してください）"); sys.exit()
def published(name, ver):
    """公開日を返す。GitHub Actions（owner/repo[/path] の形）と npm で参照先が違う。
    actions にも cooldown があるので、ここが空欄のままだと検査が実質無効になる。"""
    if "/" in name and not name.startswith("@"):
        owner_repo = "/".join(name.split("/")[:2])
        for tag in (f"v{ver}", ver):
            try:
                out = subprocess.run(["gh","api",f"repos/{owner_repo}/releases/tags/{tag}","-q",".published_at"],
                                     capture_output=True, text=True, timeout=25)
                if out.returncode == 0 and out.stdout.strip():
                    return out.stdout.strip()
            except Exception:
                pass
        return None
    try:
        out = subprocess.run(["npm","view",name,"time","--json"],capture_output=True,text=True,timeout=25)
        return json.loads(out.stdout or "{}").get(ver)
    except Exception:
        return None

today = datetime.datetime.now(datetime.timezone.utc)
for name, frm, to in rows[:12]:
    if name.lower() in ("package", "dependency"): continue
    t = published(name, to)
    if t:
        age = (today - datetime.datetime.fromisoformat(t.replace("Z","+00:00"))).days
        flag = "  ⚠️ cooldown 未達の可能性" if age < 7 else ""
        print(f"    {name}: {frm} -> {to}  公開 {t[:10]}（{age} 日前）{flag}")
    else:
        print(f"    {name}: {frm} -> {to}  ⚠️ 公開日を取得できず（手で確認すること）")
' 2>/dev/null || echo "    （解析に失敗）"
  echo
done <<< "$PRS"

echo "════════════════════════════════════════════════════════"
echo "※ この出力は判断材料です。cooldown を満たすか・どの順で入れるか・止めるべきかは"
echo "   SKILL.md の §2〜§4 に従って判断し、判定表にしてから承認を取ってください。"
