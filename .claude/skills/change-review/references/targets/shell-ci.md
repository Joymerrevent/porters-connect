# 対象: シェル / GitHub Actions

`.sh` と `.github/workflows/*.yml`（`run:` は同じ bash で、同じ壊れ方をする）。

## 1. 信じている入力

- 人 / LLM が書いた文書の機械可読行（検査時刻・指紋・対象リスト）
- 別ジョブ・別ステップから渡ってくる事実（job outputs）
- 外部コマンドの出力（`gh api` の JSON、`git` の終了ステータス）
- イベントペイロード（コメント本文、Issue 本文、ラベル、作者、`author_association`）
- リポジトリ / 環境の設定（branch protection、`dependabot.yml`、ラベルの存在、環境変数）

## 2. バグクラス

Dependabot 自動化のレビューで実際に出たもの。

### 静かに通る（fail-open）

- **空出力を成功と読む** — `x=$(cmd); [ -z "${x}" ]` を「該当なし」として扱う。**取得失敗と 0 件を区別しているか。**実例: `gh api` の失敗が「open な PR はありません」と記録され、判定が緑のまま静かに停止した。「PR は必ず 1 ファイル以上変える」のような**不変条件で殴る**。
- **事実ゼロから作った値が正当に見える** — 空入力のハッシュは 16 桁の正しい指紋に見える（空文字列の SHA-256）。それを保存すると、翌日「前回と同じ」で抑止が効く。
- **検査が空振りする** — `while read … done < <(grep …)` は、対象ファイルが読めないと 0 行を返してループが 1 度も回らない。**検証したつもりで「所定の形式です」と出力して進む。**
- **GitHub の状態語を鵜呑みにする** — `mergeable_state=clean` は**必須チェックだけ**を見る。必須設定が変われば CI ゼロでも clean。**設定に依存しない条件**（全チェックの結論が出ている）を自分で持つ。
- **jq のフィールド有無に賭ける** — `select(.author.is_bot)` はフィールドが無いと**常に偽**。外れると「毎回新規作成」のような増殖系の事故になる。代替キーも見る。

### 理由が事実と違う

- **要約だけが別のことを言う** — 行ごとの詳細は正しいのに、人が最初に読む要約が違う状態を報告する。実例: dry-run で中断したのに「1 件マージ」、worktree を作れなかっただけなのに「コミットの順序を見直せ」。**終了コードに複数の状態を混ぜると起きる。**
- **`if:` で落ちた job は無言** — リアクションもコメントも返らず、押した人には沈黙に見える。起動条件を厳しくするときは、この副作用を報告に書く。

### bash 固有

- **`$var` の直後に全角文字** — bash が `）` を変数名に吸う。`set -u` で即死し、しかも**異常を報告する行に出やすい**＝報告せずに死ぬ。`${var}` で括る（`pnpm check:shell`）。
- **CRLF** — GitHub Web UI 由来のコメント / Issue 本文は CRLF。`head -1` の末尾に `\r` が残り、見た目は正しい数字なのに正規表現が弾く。
- **クォートなしの単語分割** — `for t in ${args}` は glob 展開もされる。`set -f` を検討。
- **`local` 宣言漏れ** — 関数の作業変数が漏れると「前回の値が残る」事故の土台になる。
- **bash 3.2（macOS 既定）** — 連想配列 `declare -A` が無い。ローカル実行を想定するなら並列の添字配列で書く。
- **`gh api --paginate` と `-q`** — フィルタは**ページごとに**適用される。`length` のような集約は壊れる（行単位で出して後でまとめる）。

### 二重管理

- **`grep -m1` と重複** — 読む側が 1 本目しか見ないなら、書く側は**2 本目の存在を検出して落とす**。
- **同じ守りが片方の経路にしかない** — レポート経由の重複は弾くのにコメント経由は弾かない、など。**同じ入力に守りの有無が分かれていないか。**
- **2 箇所の真実** — ワークフローの `if:` は式なのでシェル定数を参照できない。構造的に消せない重複は、**両側にコメントで相手を指す**。
- **commitlint / hooks** — 件名の先頭大文字は弾かれる（日本語件名でも `CI:` などは NG）。pre-commit（lint-staged）は**絶対パス**を渡すので markdownlint の `ignores` を迂回する。

## 3. 当て方

### 狙い 1 — 純粋な部分を総当たり

正規表現・パーサを、受理 / 棄却の表に当てる。**本物の関数を `source` して呼ぶ**（写しを検証しない）。

```sh
cat > tmp/cases.txt <<'EOF'
accept|/merge
accept|/merge 222 221
reject|/merge foo
reject|  /merge（先頭空白）
EOF
while IFS='|' read -r want input; do ... done < tmp/cases.txt
```

### 狙い 2 — 外部コマンドを偽物に差し替える

`PATH` の先頭に偽コマンドを置くと、API 依存のスクリプトを**通しで**走らせられる。

```sh
mkdir -p tmp/fakebin
cat > tmp/fakebin/gh <<'EOF'
#!/usr/bin/env bash
set -u
# 壊れ方の指定は 1 変数に集約し、未知の値は落とす。未知のモードが正常系として
# 動くと「測ったつもりで何も測っていない」結果が表に並ぶ（2 度やった）。
case "${FAKE_MODE:-ok}" in
  ok|pulls-403|auth-fail) ;;
  *) echo "fake gh: 未知の FAKE_MODE: ${FAKE_MODE}" >&2; exit 99 ;;
esac
printf '%s\n' "$*" >> "${FAKE_GH_LOG:-/dev/null}"
case "$*" in
  *"issue list"*) echo '[]' ;;
  *) echo "fake gh: unhandled: $*" >&2; exit 1 ;;   # 未対応は必ず落とす
esac
EOF
chmod +x tmp/fakebin/gh
FAKE_GH_LOG=tmp/gh-calls.log PATH="${PWD}/tmp/fakebin:${PATH}" bash scripts/対象.sh
```

- **未対応の引数は `exit 1`。**黙って空を返すと偽物自体が fail-open になり、検証が嘘をつく。
- **呼ばれた引数をログに残す。**「叩かれると思っていた API が実は叩かれていない」がここで出る。
- **作ったら偽物自体を 1 回試す**（未知モードで 99 が返るか）。
- **同じ URL を別の `-q` で叩く呼び出しは、`-q` の中身で分岐する。** 実例: gate は `pulls?state=open` を 2 列で、`triage.sh` は同じ URL を 4 列で叩く。URL だけで分岐すると**実装ではなく偽物のバグ**を追う。

  ```sh
  if printf '%s' "$*" | grep -q 'head.ref'; then ... else ... fi
  ```

- **偽物に焼き込んだ値は古くなる。** `H=$(git rev-parse HEAD)` を生成時に展開すると、コミットを積んだ瞬間にズレる。実行時に解決する。

### 狙い 3 — 使い捨てのリポジトリ / データ

git の意味論（祖先関係、`--first-parent`、force-push と追加コミットの違い）は**実物で確かめる**。頭の中の git は間違う。

```sh
d=$(mktemp -d) && cd "${d}" && git init -q
git commit -q --allow-empty -m "base"
git switch -qc topic && git commit -q --allow-empty -m "work"
git merge-base --is-ancestor "${sha}" HEAD && echo ancestor || echo not-ancestor
```

### 狙い 4 — 本物の読み取り専用実行

副作用の無い経路（判定だけの gate、`--dry-run`、`--check`）は本物のデータで通す。**冪等性**もここで取る。

```sh
bash scripts/対象-gate.sh > tmp/run1.txt
bash scripts/対象-gate.sh > tmp/run2.txt
diff tmp/run1.txt tmp/run2.txt || echo "冪等でない"
```

書き込み経路は本物で走らせない。偽コマンドに差し替えるか `--dry-run` を使う。

### 狙い 5 — 本番と同じ起動の形

CI の検証は**ワークフローが書いているコマンドそのもの**を写して走らせる（`.github/workflows/*.yml` の `run:` を読む）。手元の `pnpm test` が緑でも、CI が別のコマンドを叩いていれば保証にならない。hook 経由なら設定ファイル（`lint-staged.config.mjs` など）を読んでから再現する。

### 実データで前提を潰す

「一般にどうか」を議論しかけたら止めて、**この repo の実績**を見る。

```sh
R=Joymerrevent/porters-connect
gh api "repos/${R}/issues/NNN/timeline" --paginate -q '.[].event' | sort | uniq -c   # force-push の実績
gh api "repos/${R}/pulls/NNN/commits" -q '.[] | "\(.sha[0:7]) parents=\(.parents|length)"'
gh api "repos/${R}/branches/develop/protection/required_status_checks"                # 必須チェックの実体
gh api "repos/${R}/commits/SHA/check-runs" -q '.check_runs[] | "\(.name) \(.conclusion)"'
```

## 4. 道具と落とし穴

- **`gh`** — `/opt/homebrew/bin/gh`。サンドボックスの `PATH` に無いことがあるので、見つからなければ絶対パスで叩く。
- **`jq`** — フィルタは本番に入れる前に手元の JSON に当てる。`select(.a.b)` はフィールドが無いと**常に偽**。
- **YAML パーサ** — `js-yaml` も python の `yaml` も無い。`node_modules/.pnpm/yaml@*/node_modules/yaml` を直接 require する。ワークフローの `if:` やステップ構成は**パースして数える**（目視で数えない）。
- **`pnpm check:shell`** — `$var` の直後の非 ASCII を検出（`.claude/` 配下の `.sh` も対象）。
- **`bash --version` は 3.2**（macOS 既定）。CI の ubuntu は 5.x。**手元で通って CI でも通る形**（3.2 互換）に寄せる。
- **`tmp/`** は `.gitignore` 済み。作業場所に使ってよい。

## 5. まだ当てていないこと

- **GitHub Actions 上でしか確かめられないもの** — ワークフローの `if:` 式、`author_association` による制限、`::error::` が annotation として拾われるか、`actions/checkout` の `fetch-depth: 0` が何を取るか、実 API（`gh pr merge` / `update-branch`）の挙動。
- **経路網羅を機械で測れていない。** `kcov` / `bashcov` が無く、通した経路は人の列挙に基づく。TypeScript 側が coverage で機械保証しているのと非対称。
- 使った実績は Dependabot 自動化の 1 ブランチのみ（5 巡）。
