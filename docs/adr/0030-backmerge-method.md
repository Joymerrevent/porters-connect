# 30. back-merge 方式の改訂（ADR-0029 案F を supersede）

- Status: proposed
- Date: 2026-06-21
- Deciders: jun.shiromoto (Joymerrevent)
- Supersedes: [ADR-0029][adr29] の back-merge サブ決定（案F）のみ（タグ＋publish ＝ 案B は不変）

> ADR-0029 は back-merge を **案F（auto-tag ワークフローで develop へ直 push・`GITHUB_TOKEN` を bypass actor 化）**
> と accepted したが、実装直前の調査で **`GITHUB_TOKEN` は保護ブランチへ直 push できない**と判明。案F は実現不可。
> back-merge 方式を選び直す。

## Context and Problem Statement

リリース後、main の version/CHANGELOG を develop へ戻す back-merge が要る（git-flow）。
ADR-0029 の案F は「ワークフローが develop へ直 push」だったが、**`GITHUB_TOKEN` は保護ブランチ（develop）へ
直接 push できない**（GitHub の仕様）。bypass には **GitHub App か PAT** が要る。

関連する落とし穴（ADR-0029 記載）：

- `GITHUB_TOKEN` で作成した PR は CI を起動しない（必須チェックが付かずマージ不能）。
- `GITHUB_TOKEN` で push したタグ・作成した Release は他のワークフローを起動しない。

## Decision Drivers

- **トークンレス維持**（長期シークレット・秘密鍵を増やさない＝フェイルセーフ）。
- back-merge は **低頻度**（リリース毎・月数回以下）・**低リスク**（version/CHANGELOG 同期のみ）。
- 運用が**属人化しすぎない**こと。

## Considered Options

- **案F（不可・参考）**：auto-tag ワークフローで develop へ直 push。`GITHUB_TOKEN` では実現不可＝本 ADR の発端。
- **案G：自動で back-merge PR を作成**（`gh pr create`・`GITHUB_TOKEN`）。PR は作れるが **CI が走らず必須チェックが付かない** → そのままマージ不可。人が close→reopen で CI 起動 or admin マージが要る。
- **案H：手動 back-merge**（リリース後に `git merge` 1ステップ・runbook §2）。追加ゼロ・完全トークンレス。
- **案I（新規）：GitHub App で完全自動**。App トークンで develop へ直 push（または CI も起動する PR 作成）。完全自動だが App 作成＋秘密鍵 Secret＋develop の ruleset 化＋bypass 登録が要る。

## Decision Outcome

未決（proposed）。

### 推奨（私案）

**案H（手動）**。back-merge は低頻度・低リスクで `git merge` 1コマンドで済む。
案G は「PR は出るが merge にひと手間」で半端、案I は秘密鍵が増えトークンレス／フェイルセーフ方針に反する。
「タグ忘れ」という発端の不満はタグ＋publish の自動化（案B）で既に解消済みなので、back-merge は無理に自動化しない。
将来 back-merge の頻度・手間が増えたら案I（GitHub App）を再評価する。

### Consequences

- （決定後に記入）accept 後：[ADR-0029][adr29] に「back-merge は本 ADR で superseded」の一行ポインタを追記。
- 実装 PR #76（`tag.yml` は back-merge を含めず・runbook は手動）はこの推奨と整合。

## Pros and Cons of the Options

### 案G 自動 PR

- Good: back-merge が PR として可視・レビュー可能。トークンレスで PR 作成まではできる。
- Bad: `GITHUB_TOKEN` 製 PR は CI 不起動 → 必須チェック未報告でマージ不能。close/reopen か admin マージのひと手間。

### 案H 手動（推奨）

- Good: 追加ゼロ・完全トークンレス・単純。低頻度なので負担小。
- Bad: 手作業が1ステップ残る（タグ・publish は自動なので発端の「タグ忘れ」は解消済み）。

### 案I GitHub App

- Good: 完全自動（直 push or CI 付き PR）。
- Bad: App 作成・秘密鍵 Secret・ruleset 化・bypass 登録。トークンレス方針に反し、ソロには重い。

## More Information

- 出典：`GITHUB_TOKEN` は保護ブランチへ直 push 不可（要 GitHub App / PAT）。[Ninjaneers/Medium][s1]／[community #25305][s2]／[Mercari Engineering][s3]。
- 関連: [ADR-0029][adr29]（タグ＋publish ＝ 案B は本 ADR の対象外・不変）／ [release-runbook][rb]。

[adr29]: 0029-release-tag-automation.md
[rb]: ../release-runbook.md
[s1]: https://medium.com/ninjaneers/letting-github-actions-push-to-protected-branches-a-how-to-57096876850d
[s2]: https://github.com/orgs/community/discussions/25305
[s3]: https://engineering.mercari.com/en/blog/entry/20241217-github-branch-protection/
