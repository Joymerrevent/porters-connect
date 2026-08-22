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
- **branch protection が base の鮮度を要求**する。1 件マージすると残りは `Base branch was modified` で弾かれる。
- `gh pr merge` は `permissions.ask` で確認プロンプトが出る。**これは仕組み側のフェイルセーフなので迂回しない。**

## 実行フロー

### 1. 状態を集める

**必ず `git fetch --prune` から始める。** リモート追跡ブランチが古いと、既に消えたブランチを追いかけて的外れな診断をすることになる（`update-branch` が `head ref does not exist` を返して初めて気づく、という遠回りが実際に起きた）。

```bash
bash .claude/skills/dependabot-merge/scripts/triage.sh
```

このスクリプトが集めるもの — open な dependabot PR、head SHA、mergeable 状態、**head SHA に対する** CI の結果、変更ファイル、PR 本文から抜いた「パッケージ → 更新先バージョン」、npm 上の公開日。

出力は判定の材料であって判定そのものではない。次のステップで意味づけする。

### 2. cooldown を突き合わせる

**PR が open であること自体は、cooldown を満たしている証拠にならない。** Dependabot は設定変更前に作られた PR を後から再評価して閉じることがある。

```text
dependabot[bot]: Looks like fast-xml-parser is no longer updatable, so this is no longer needed.
```

これが出ていたら**それは失敗ではなく、サプライチェーン対策が意図どおり働いた形**。閉じられた PR を無理に復活させない。「いつ熟成するか」を計算して伝え、その日以降の定期実行で再作成されるのを待つ。

自分でも確かめる — スクリプトが出す公開日と今日の差を、その更新の semver ステップに対応する日数と比べる。`patch`/`minor` なら 7 日、`major` なら 14 日（npm の場合）。**足りていなければ、CI が緑でもマージしない。**

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

### 5. 1 件ずつマージする

承認を得たら、**1 件マージするごとに残りの base が古くなる**ことを前提に進む。

1. base が古ければ更新する（競合しないことを先に確かめる）:

   ```bash
   gh api -X PUT repos/{owner}/{repo}/pulls/{N}/update-branch -f expected_head_sha=<head SHA>
   ```

   `git diff --quiet <PR の base>..origin/develop -- pnpm-lock.yaml` が真なら競合しない。

2. **更新後の head SHA で CI が緑になるのを待つ**。古い CI の結果でマージしない — ロックファイルは競合を機械的に解決すると壊れた内容になりやすく、しかも壊れ方が静かで気づきにくい。

3. `gh pr merge <N> --squash --delete-branch`

4. `git fetch --prune` して次へ。

### 6. 結果を報告する

マージした PR、見送った PR とその理由、次に動きが必要なもの（cooldown 明けの再作成待ちなど）を書く。

## つまずいたときの読み方

- **`Base branch was modified`** — branch protection が base の鮮度を要求している。§5 の update-branch から。
- **`head ref does not exist`（422）** — ブランチが消えている。PR が閉じられた可能性が高いので、まず `git fetch --prune` と PR の state を確認する。
- **`gh pr view` / `gh pr checks` が分類器にブロックされる** — マージ操作の文脈でブロックされることがある。`gh api` と `git log` に切り替えれば同じ情報が取れる（実際に起きた）。
- **dependabot が PR を閉じた** — §2 のとおり。異常ではない。

## やらないこと

- **`main` 向けの PR をこのスキルで扱わない。** リリース PR は `docs/release-runbook.md` の手順。
- **`dependabot.yml` の編集**は対象外（cooldown 日数を変えたいなど）。設定変更は影響が広いので独立して扱う。
- **cooldown を回避するための設定変更を提案しない。** 待てないほど急ぐなら、それは security update の話であって version update の話ではない（security updates は cooldown を素通りする）。
