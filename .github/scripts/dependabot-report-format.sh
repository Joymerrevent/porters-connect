#!/usr/bin/env bash
# 追跡 Issue のレポートのうち、**機械が読む行**の形をここ 1 箇所で定義する。
#
# なぜ共有するか: 読む側（gate）と検証する側（publish）が別々に形を持つと、
# 「投稿は通ったのに次回の実行要否が壊れている」というズレが静かに起きる。
# 実際、検証していない行が読めなくなると 3 日ルール（cooldown 熟成の取りこぼし防止）が
# 黙って無効化される。形の定義が 1 つなら、崩れたレポートは**投稿の前に必ず落ちる**。
#
# 見出しの構造は雛形 .claude/skills/dependabot-merge/templates/report.md が正で、
# ここが受け持つのは「その中で機械が値を取り出す 3 行」だけ。
# この 3 行を変えるときは、雛形とワークフローのプロンプトも同時に直すこと。

# 追跡 Issue の同定。タイトル一致だけだと public リポジトリでは**誰でも同名の Issue を
# 立てられる**ので、ラベル（付けられるのは write 権限を持つ人だけ）と bot 作者を併用する。
DEPENDABOT_ISSUE_TITLE="Dependabot 判定レポート"
# NOTE: ラベル名は .github/workflows/dependabot-merge.yml の起動条件にも直書きされている
# （ワークフローの `if:` は式なので、このシェル定数を参照できない）。片方だけ変えると
# **/merge が無言で起動しなくなる**ので、変えるときは必ず両方を直すこと。
DEPENDABOT_ISSUE_LABEL="dependabot-triage"

# 追跡 Issue を選ぶ jq 述語。gate（読む側）と publish（書く側）で同じものを使う
# ＝「どれが自分たちの Issue か」の定義が 1 つになる。
# is_bot だけに賭けないのは、gh の author に is_bot が無い／false だった場合に
# **毎回「既存 Issue なし」と判断して新しい Issue を作り続ける**ため。login でも拾う。
# 逆に login の前方一致にしないのは、github-actions-… という第三者アカウントを
# 巻き込まないため（ラベルと合わせて二重に絞る）。
DEPENDABOT_ISSUE_FILTER="select(.title == \"${DEPENDABOT_ISSUE_TITLE}\") | select((.author.is_bot // false) or (.author.login // \"\") == \"github-actions\" or (.author.login // \"\") == \"github-actions[bot]\")"

# 検査時刻（ISO 8601 / UTC）。gate が「前回から何日経ったか」に使う。秒は省略可。
REPORT_TIMESTAMP_RE='^- 検査時刻: [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2})?Z$'

# 判定の指紋。gate が次回の実行要否に使う（gate が emit する 16 桁をそのまま）。
REPORT_FINGERPRINT_RE='^- 判定の指紋: `?[0-9a-f]{16}`?$'

# 取り込み対象。番号を省略した `/merge` が**この 1 行だけ**を読んでマージ対象と順序を決める。
# 節の散文に PR 番号が出てきても拾わない＝「見送り」と書かれた番号を巻き込まない。
REPORT_MERGE_PLAN_RE='^- 取り込み対象: (なし|#[0-9]+([[:space:]]*(→|,)?[[:space:]]*#[0-9]+)*)[[:space:]]*$'
