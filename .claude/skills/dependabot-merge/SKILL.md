---
name: dependabot-merge
description: >-
  Dependabot が作った依存更新 PR（npm 依存・GitHub Actions）を、マージして安全かを
  検証してから順に取り込む。cooldown（熟成期間）・CI・base の鮮度・ロックファイルの
  競合順序を機械的に確かめ、判定表を出してから 1 回の承認でまとめてマージする。
  「dependabot の PR をマージして」「依存更新の PR を見て」「バージョンアップの PR を
  処理して」「依存関係の PR たまってる」などと言われたら、たとえ "スキル" と明示されなく
  ても必ずこのスキルを使う。PR 番号を指定された場合も、複数たまっている場合も同じ。
  なお dependabot.yml そのものを編集したい場合はこのスキルの対象外。
---

# Dependabot PR の検証とマージ

依存更新 PR は**同じ確認を毎回やる作業**で、しかも**間違えても静かに通ってしまう**種類の作業。だから確認を人の記憶に置かず、手順として固定する。

このスキルの価値は「マージのクリックを代行すること」ではなく、**通してよいかの判断材料を毎回同じ深さで揃えること**にある。judgment が要る箇所（major 更新、prod 依存、CI の落ち方）は必ず人に見せる。

## このリポジトリの前提

以下は `.github/dependabot.yml` と実測に基づく。**判断の根拠は毎回この設定を読んで確かめる**（設定は変わりうるし、変わったことに気づかないのが一番危ない）。

- **対象ブランチは `develop`**（`target-branch: develop`）。`main` ではない＝**マージしても npm 公開は起動しない**（公開の引き金は GitHub Release の作成のみ・`docs/release-runbook.md`）。だから依存 PR のマージは**リリースより可逆性が高い**。
- **グループ**: npm の `dev-dependencies` / `prod-dependencies`（minor・patch をまとめる）、github-actions の `actions`。**major は意図的にグループ外＝個別 PR**で来る。個別に来ている時点で「単独で判断してほしい更新」というシグナル。
- **cooldown（熟成期間）**が設定されている。npm は major 14 日・minor/patch 7 日、actions は一律 7 日。**公開直後の版を避けて、悪性リリースが発見・削除される時間を稼ぐ**のが狙いで、防御の本体は「時間」。
- **マージは squash**（履歴が `… (#NNN)` の形）。
- **base の鮮度は GitHub 側では要求されていない**（`develop` / `main` とも `strict: false`・ruleset なし・
  必須レビュー 0。必須チェックは `ci` と `stryker`）。1 件マージしても残りはそのままマージできてしまう。
  **それでも `update-branch` する**理由は [ADR-0065][adr65] 論点6 のとおり — 止めてくれないからこそ、
  更新しないと「develop を取り込んだ後のロックファイル」に対して CI が一度も走らないまま develop に入る。
  ロックファイルは機械的に解決すると静かに壊れるので、ここは CI に検証させる。
- `gh pr merge` は `permissions.ask` で確認プロンプトが出る。**これは仕組み側のフェイルセーフなので迂回しない。**
- **これが唯一の経路。** かつて GitHub Actions で判定と取り込みを自動化していたが、
  [ADR-0067][adr67] で畳んだ。`GITHUB_TOKEN` による書き込みは CI を起動できず
  （push では run が作られず、`update-branch` では毎回承認待ちになる）、
  マージ後の状態を検証する手段が無かったため。詳細は [設計前提の調査][facts]。
  依存 PR は週 3 件・滞留は多くが 0〜1 日で、自動化が省くのはクリック 1 回だった。

## 実行フロー

### 1. 状態を集める

**必ず `git fetch --prune` から始める。** リモート追跡ブランチが古いと、既に消えたブランチを追いかけて的外れな診断をすることになる（`update-branch` が `head ref does not exist` を返して初めて気づく、という遠回りが実際に起きた）。

```bash
bash .claude/skills/dependabot-merge/scripts/triage.sh
```

このスクリプトが集めるもの — open な dependabot PR、head SHA、mergeable 状態、**head SHA に対する** CI の結果、変更ファイル、PR 本文から抜いた「パッケージ → 更新先バージョン」、公開日（npm / GitHub Actions で参照先が違う）。

出力は判定の材料であって判定そのものではない。次のステップで意味づけする。

**open な PR がゼロなら、そう報告して終わる。** 閉じられた PR を調べに行かない — 閉じられた PR はマージできないので行動につながらず、頼まれていない仕事になる。特定の PR が見当たらなくて探している場合だけ、下の「つまずいたときの読み方」を見る。

### 2. cooldown を突き合わせる

**PR が open であること自体は、cooldown を満たしている証拠にならない。** Dependabot は設定変更前に作られた PR を後から再評価して閉じることがある。

```text
dependabot[bot]: Looks like fast-xml-parser is no longer updatable, so this is no longer needed.
```

これが出ていたら**それは失敗ではなく、サプライチェーン対策が意図どおり働いた形**。閉じられた PR を無理に復活させない。「いつ熟成するか」を計算して伝え、その日以降の定期実行で再作成されるのを待つ。

自分でも確かめる — スクリプトが出す公開日と今日の差を、その更新の semver ステップに対応する日数と比べる。`patch`/`minor` なら 7 日、`major` なら 14 日（npm の場合）。**足りていなければ、CI が緑でもマージしない。**

日数は**時刻まで見て切り捨てる**。「8/16 公開・8/22 現在」は日付の引き算だと 7 日だが、実際に 6 日 10 時間なら **6 日**と数える。安全側に倒すためだが、「日付上は足りているのになぜ」と見えるので、境界が近いときは**あと何時間で熟成するか**まで伝える。

### 3. 分類して順番を決める

競合するのは**同じファイルを触る PR** で、依存 PR ではほぼ `pnpm-lock.yaml` に集中する。

| 種類 | 触るもの | 扱い |
| --- | --- | --- |
| **prod 依存** | `pnpm-lock.yaml`（＋範囲が変われば `package.json`） | **利用者に届く**。単独でマージして、develop の緑をこの変更に帰属させる |
| **dev 依存** | 同上 | 同梱されない。ただし lint/test ゲートを動かすツール（eslint・commitlint 等）が含まれるなら CI の緑に意味がある |
| **actions** | `.github/workflows/*` | ロックファイルと競合しない。独立して動かせる |
| **major**（個別 PR） | 各種 | **グループ外で来ている＝単独判断してほしい更新**。CHANGELOG の破壊的変更と Node 要件（`engines`）を必ず確認し、人に見せる |

順番の原則は「**競合しないものから、影響の重いものは単独で**」。典型的には actions → prod 依存 → dev 依存。ただし機械的に当てはめず、実際の変更ファイルの重なりで決める。

### 4. 判定表を出す

マージ前に必ず出す。**人が「これは止めたい」と言える形**にするのが目的なので、緑だけでなく懸念も書く。

```markdown
| PR | 種類 | 更新 | cooldown | CI | base | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| #174 | dev 依存 5 件 | commitlint 21.2.1→21.2.2 ほか | ✅ 9〜12 日 | ✅ 6/6 | ⚠️ 古い | 更新後マージ可 |
| #173 | prod 依存 | fast-xml-parser 5.10.1→5.11.0 | ❌ 6 日（7 日必要） | ✅ | — | **見送り**（8/23 以降） |
```

そのうえで、**マージしてよいかを 1 回だけ確認する**。件数分聞かない（退屈な往復を減らすのがこのスキルの目的なので）。

止めるべき兆候があるなら、判定表と一緒に言葉でも伝える — major 更新、prod 依存、CI の一部だけ赤、cooldown 不足、PR 本文に破壊的変更の記載。

列の意味と埋め方は `templates/report.md` が正。**形を変えるときは雛形の側を直す。**
毎回同じ形にすることで「前回と何が変わったか」が読める — 形が毎回変わるレポートは、
読む側が差分ではなく全文を読み直す羽目になり、結局読まれなくなる。

### 5. 1 件ずつマージする

承認を得たら、**1 件マージするごとに残りの base が古くなる**ことを前提に進む。
GitHub は古い base を弾かないので、**弾かれないことを理由に飛ばさない**（上記の前提を参照）。

**取り込む前に、判定したときのコミットのままかを確かめる。** 承認は「その PR」ではなく
**「その PR のそのコミット」**に対して出ている。判定後に dependabot が force-push していれば、
誰も CHANGELOG を読んでいないコミットを取り込むことになる:

```bash
git merge-base --is-ancestor <判定時の head SHA> <現在の head SHA>
```

偽なら取り込まず、判定からやり直す。base を取り込む merge は祖先関係を壊さないので、
`update-branch` した場合もこの確認は通る。レポートの `- 取り込み対象: #222@<SHA>` に
判定時の SHA を書いておくと、時間が空いても突き合わせられる。

1. base が古ければ更新する（競合しないことを先に確かめる）。更新するのは protection に要求されるからではなく、
   **マージ後の状態に CI を通すため**:

   ```bash
   gh api -X PUT repos/{owner}/{repo}/pulls/{N}/update-branch -f expected_head_sha=<head SHA>
   ```

   `git diff --quiet <PR の base>..origin/develop -- pnpm-lock.yaml` が真なら競合しない。

   **人が実行する限り、更新後の CI は普通に走る。** 自動化を畳んだのはここが理由で、
   `GITHUB_TOKEN` で同じことをすると CI が毎回承認待ちになる（[設計前提の調査][facts]）。

2. **更新後の head SHA で CI が緑になるのを待つ**。古い CI の結果でマージしない — ロックファイルは競合を機械的に解決すると壊れた内容になりやすく、しかも壊れ方が静かで気づきにくい。

3. `gh pr merge <N> --squash --delete-branch`

4. `git fetch --prune` して次へ。

### 6. 結果を報告する

マージした PR、見送った PR とその理由、次に動きが必要なもの（cooldown 明けの再作成待ちなど）を書く。

## つまずいたときの読み方

- **`Base branch was modified`** — **現在の設定では起きないはず**（`strict: false`）。出たなら
  branch protection か ruleset が変わっている。前提の記述ごと確かめ直す（設定は変わりうるし、
  変わったことに気づかないのが一番危ない）。対処自体は §5 の update-branch でよい。
- **`head ref does not exist`（422）** — ブランチが消えている。PR が閉じられた可能性が高いので、まず `git fetch --prune` と PR の state を確認する。
- **`gh pr view` / `gh pr checks` が分類器にブロックされる** — マージ操作の文脈でブロックされることがある。`gh api` と `git log` に切り替えれば同じ情報が取れる（実際に起きた）。
- **あったはずの PR が見当たらない** — dependabot が自分で閉じた可能性が高い（§2）。閉じられた PR を探すのはこの場合だけでよい:

  ```bash
  gh api "repos/{owner}/{repo}/pulls?state=closed&per_page=20" \
    -q '.[] | select(.user.login=="dependabot[bot]" and .merged_at==null) | "#\(.number) \(.title)"'
  ```

  見つかったら PR のコメントで理由を確認し、cooldown が理由なら**いつ熟成するか**を計算して伝える。閉じられた PR は復活させない。

## やらないこと

- **`main` 向けの PR をこのスキルで扱わない。** リリース PR は `docs/release-runbook.md` の手順。
- **`dependabot.yml` の編集**は対象外（cooldown 日数を変えたいなど）。設定変更は影響が広いので独立して扱う。
- **cooldown を回避するための設定変更を提案しない。** 待てないほど急ぐなら、それは security update の話であって version update の話ではない（security updates は cooldown を素通りする）。

[adr65]: ../../../docs/adr/0065-dependabot-update-automation.md
[adr67]: ../../../docs/adr/0067-retire-dependabot-automation.md
[facts]: ../../../docs/design/dependabot-automation-facts.md
