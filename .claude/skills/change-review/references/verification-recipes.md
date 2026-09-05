# 実行して確かめる — 5 パターンと道具

読むだけで分かることと、動かして初めて分かることは**別のカテゴリ**。前回のレビューでは、**実際に動かした回だけ新しい種類の指摘が出た**という相関がはっきり出た。ここはその「動かし方」の型。

作業ファイルは `tmp/` 配下（`.gitignore` 済み）か、セッションのスクラッチパッドに置く。リポジトリを汚さない。

---

## 1. 純粋な部分を切り出して総当たり

正規表現・パーサ・純関数は、**受理してほしい入力と棄却してほしい入力を先に表にしてから**流す。先に書くのが肝で、そうしないと「出た結果」を後から正当化してしまう。

```sh
# 例: 取り込み指示コメントを受理する正規表現を、入力表に当てる
cat > tmp/cases.txt <<'EOF'
accept|/merge
accept|/merge 222 221
reject|/merge foo
reject|  /merge（先頭空白）
EOF

while IFS='|' read -r want input; do
  # ここで本物のスクリプトの関数を source して呼ぶ（コピーして書き直さない）
  ...
done < tmp/cases.txt
```

**必ず本物の実装を呼ぶ。** 正規表現を報告用に書き写した時点で、検証しているのは写しであって実装ではない。

CRLF・全角・大文字・前後空白・空文字列は**毎回入れる**。GitHub の Web UI 由来の入力は CRLF で来る。

TypeScript 側なら、同じことを vitest の `it.each` でやる。既存テストに追加すれば、検証がそのまま回帰テストとして残る（これが望ましい形）。

## 2. 外部コマンドを偽物に差し替える

`PATH` の先頭に偽コマンドを置くと、API 依存のスクリプトを**通しで**走らせられる。前回はこれで「`is_bot` フィールドへの依存」と「引き当て失敗と初回実行の混同」が出た。

```sh
mkdir -p tmp/fakebin
cat > tmp/fakebin/gh <<'EOF'
#!/usr/bin/env bash
# 引数で分岐して固定応答を返す偽 gh。呼ばれた引数を必ず記録する
# （どの経路が実際に叩かれたかは、それ自体が検証結果になる）。
set -u
printf '%s\n' "$*" >> "${FAKE_GH_LOG:-/dev/null}"

case "$*" in
  *"issue list"*)
    # ← ここを空配列 / 1 件 / is_bot 欠落 の 3 通りに差し替えて回す
    echo '[]' ;;
  *"pr view"*)
    echo '{"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN"}' ;;
  *)
    echo "fake gh: unhandled: $*" >&2; exit 1 ;;
esac
EOF
chmod +x tmp/fakebin/gh

FAKE_GH_LOG=tmp/gh-calls.log PATH="${PWD}/tmp/fakebin:${PATH}" bash scripts/対象.sh
```

要点:

- **未対応の引数は `exit 1` で落とす。** 黙って空を返すと、偽物自体が fail-open になり、検証が嘘をつく。
- **呼ばれた引数をログに残す。** 「叩かれると思っていた API が実は叩かれていない」がここで出る。
- **同じ URL を別の `-q` で叩く呼び出しは、URL ではなく `-q` の中身で分岐する。** 実例: `dependabot-triage-gate.sh` は `pulls?state=open` を 2 列（番号・head SHA）で、`triage.sh` は同じ URL を 4 列（＋ブランチ名・タイトル）で叩く。URL だけで分岐すると、片方に列数の合わない応答を返してしまい、**実装ではなく偽物のバグ**を追うことになる。

  ```sh
  if printf '%s' "$*" | grep -q 'head.ref'; then ... else ... fi
  ```

- **応答は 1 通りで終わらせない。** [breakage-matrix.md][matrix] §2 の 7 つの壊れ方を、偽物の応答として順に食わせる。特に**空・フィールド欠落・2 件以上**。
- **壊れ方の指定（モード）も偽物自身に検証させる。** 未知のモードを渡すと偽物は**正常系として動く**ので、「測ったつもりで何も測っていない」結果が表に並ぶ。実際にこれを 2 度やった（用意し忘れた `FAKE_MODE` と、綴りだけ違う環境変数）。モードは 1 つの変数に集約し、冒頭で既知の値だけを許す:

  ```sh
  case "${FAKE_MODE:-ok}" in
    ok|pulls-403|auth-fail) ;;
    *) echo "fake gh: 未知の FAKE_MODE: ${FAKE_MODE}" >&2; exit 99 ;;
  esac
  ```

  作ったら**偽物自体を 1 回試す**（未知のモードで 99 が返るか）。場当たりの環境変数を増やすと、綴り間違いが無言で正常系になる。
- **期待する出力に「その経路を通った証拠」を含める。** 上の取り違えに気づけたのは、失敗しているはずの行に**指紋の値が出ていた**から。結果が正常系と見分けの付かない形なら、その検証は何も言っていない。表には合否だけでなく、経路を識別できる値（終了コード・理由の文字列・生成された ID）を並べる。

## 3. 使い捨てのリポジトリ / データを作る

git の意味論（祖先関係、`--first-parent`、force-push と追加コミットの違い）は**実物で確かめる**。頭の中の git は間違う。前回はこれで「祖先チェックは force-push を捕まえるが、**追加コミットは通す**」が出た。

```sh
d=$(mktemp -d) && cd "${d}" && git init -q
git commit -q --allow-empty -m "base"
git switch -qc topic && git commit -q --allow-empty -m "work"
# 検証したい判定をここで実際に走らせる（追加コミット / force-push / merge を作り分ける）
git merge-base --is-ancestor "${sha}" HEAD && echo ancestor || echo not-ancestor
```

## 4. 本物の読み取り専用実行

副作用の無い経路（判定だけを行う gate、`--dry-run`、`--check`）は**本物のデータで通す**。ここで **冪等性** も取れる:

```sh
bash scripts/対象-gate.sh > tmp/run1.txt
bash scripts/対象-gate.sh > tmp/run2.txt
diff tmp/run1.txt tmp/run2.txt || echo "冪等でない: 出力が実行ごとに変わる"
```

**書き込み経路は本物で走らせない。** 偽コマンド（§2）に差し替えるか、`--dry-run` があるならそれを使う。

## 5. 本番と同じ起動の形で確かめる

**引数の渡し方が違うだけで結論が反転する。** 前回の実例:

`templates/report.md` の `<!-- markdownlint-disable-file MD041 -->` を「`.claude` は markdownlint の `ignores` に入っているから不要」と判断して削除した。手元検証は**相対パス**で走らせたので `ignores` が効いて 0 issues になり、誤った確信を得た。実際の pre-commit（lint-staged）は**絶対パス**を渡すので `ignores` を迂回し、削除した瞬間にコミットが弾かれた。

だから確かめるときは、**本番が実際に叩く形**を読んでから再現する。

```sh
# 設定を読んで、本番の起動の形を確認してから再現する
cat lint-staged.config.mjs
pnpm exec markdownlint-cli2 --fix "$(pwd)/対象.md"   # 絶対パス＝pre-commit と同じ形
pnpm exec prettier --write "$(pwd)/対象.md"
```

同じ考え方で、CI の検証は**ワークフローが書いているコマンドそのもの**を写して走らせる（`.github/workflows/*.yml` の `run:` を読む）。手元の `pnpm test` が緑でも、CI が別のコマンドを叩いていれば保証にならない。

## 6. 実データで前提を潰す

「一般にどうか」を議論しかけたら止めて、**この repo の実績**を見る。前回、force-push の有無は議論する必要がなく、API を叩けば済んだ。

```sh
R=Joymerrevent/porters-connect

# force-push が実際にあったか（イベント履歴）
gh api "repos/${R}/issues/NNN/timeline" --paginate -q '.[].event' | sort | uniq -c

# PR に積まれたコミットの正体（親が 2 個ならマージコミット）
gh api "repos/${R}/pulls/NNN/commits" -q '.[] | "\(.sha[0:7]) parents=\(.parents|length) \(.commit.message|split("\n")[0])"'

# 必須チェックの実体（mergeable_state=clean が何を見ているか）
gh api "repos/${R}/branches/develop/protection/required_status_checks"

# 実際に走るチェック名と結論
gh api "repos/${R}/commits/SHA/check-runs" -q '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'
```

**注意**: `--paginate` と `-q` を併用すると、フィルタが**ページごとに**適用される。`length` などの集約は壊れるので、行単位で出してから `sort | uniq -c` でまとめる。

## 7. コミットごとの検証

「各コミット単独で緑」（メモリ: Commit granularity）は、目視ではなく機械で確かめる。

```sh
bash .claude/skills/change-review/scripts/per-commit-gates.sh              # develop..HEAD
bash .claude/skills/change-review/scripts/per-commit-gates.sh main         # 基点を変える
bash .claude/skills/change-review/scripts/per-commit-gates.sh develop -- "pnpm -s check:shell"
```

`git worktree add --detach` で各コミットを取り出し、ゲートを回して表で返す。詳細と制約（`node_modules` の扱い）はスクリプト冒頭のコメントに書いてある。

**長いブランチは二段で回す。** コミットごとに worktree を作り直すので、既定ゲート 3 本 × 数十コミットは素直に時間を食う。軽いゲートで全部を通してから、赤が出たコミットだけ重いゲートで見直す:

```sh
# 1) 軽いゲートで全コミットを通す
bash .claude/skills/change-review/scripts/per-commit-gates.sh develop -- "pnpm -s typecheck"
# 2) 赤が出たコミットだけ。`^` を基点にするとその 1 件だけが対象になる
bash .claude/skills/change-review/scripts/per-commit-gates.sh 9b80ee3^ -- "pnpm -s lint" "pnpm -s test"
```

## 8. この repo で使える道具と落とし穴

- **`gh`** — `/opt/homebrew/bin/gh`。サンドボックスの `PATH` に無いことがあるので、見つからなければ絶対パスで叩く。
- **`jq`** — フィルタは本番に入れる前に、手元の JSON に当てて確かめる。`select(.a.b)` はフィールドが無いと**常に偽**。
- **YAML パーサ** — `js-yaml` も python の `yaml` も無い。`node_modules/.pnpm/yaml@*/node_modules/yaml` を直接 require する。
- **`pnpm check:shell`** — `.sh` と `.github/workflows/*.yml` の「`$var` の直後に非 ASCII」を検出（`.claude/` 配下の `.sh` も対象）。
- **`bash --version` は 3.2**（macOS 既定）。`declare -A` は使えない。CI の ubuntu は 5.x なので、**手元で通って CI で通る形**（3.2 互換）に寄せる。
- **`tmp/`** は `.gitignore` 済み。検証の作業場所として使ってよい。

## 9. TypeScript ではどう当てるか

§1〜§5 はシェルと外部コマンドを前提に書いてある。TypeScript の変更には**同じ狙いの別の手**を使う。狙いは変わらない — 読むより先に、実行と実データで確かめる。

| §1〜§5 の型 | TypeScript での対応物 |
| --- | --- |
| 1 純粋な部分を総当たり | `it.each` で受理 / 棄却の表を流す。**検証がそのまま回帰テストとして残る**ので、この形が最良 |
| 2 外部コマンドを偽物に | mock transport / fixture。**未モックの経路が既定 200 を返さない**ことを確かめる（RV-6） |
| 3 使い捨てのデータ | fixture を実データから起こす。手で書いた fixture は本番と乖離する（RV-2） |
| 4 本物の読み取り専用実行 | `pnpm test:coverage`（per-file 100%・ADR-0014）。**落ちた行ではなく、通っていない行**を見る |
| 5 本番と同じ起動の形 | 公開 API から呼ぶ。内部関数を直接叩くと、既定値の適用や alias の prefix 付与といった**公開サーフェス側の組み立てを飛ばして**通ってしまう |

TypeScript にしかない当て方が 3 つある。

- **型定義まで降りる。** 「型が過剰約束していないか」は実装ではなく型が決める。`ReadRecord<F> = { [K in keyof F]?: … }` のように**全項目が optional**なら、返らない項目があっても型は嘘をついていない。実装だけ読んで「過剰約束だ」と書くと外す（実際に外した）。
- **`as` を数える。** 差分中の型アサーションは 1 つずつ健全性を確かめる。`Object.keys()` を alias の union へ狭める程度なら健全だが、**なぜ必要かを説明できないアサーション**は型検査を黙らせている。
- **正典との突合をテストにする。** `docs/reference` とカタログのズレは実行では出ない（どちらも「正しく」動くから）。突合そのものをテストに書けば、reference を更新したときに落ちる（RV-29）。

**未確認の前提は `docs/live-verification.md` に登録されているかを見る。** 契約環境が無いと確かめられない挙動に依存する変更は、それ自体は defect ではない。見るべきは「登録されているか」「**外れたときの是正手順が書いてあるか**」で、両方あれば受容済みのリスクとして扱う。

[matrix]: breakage-matrix.md
