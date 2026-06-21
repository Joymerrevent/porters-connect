# 29. リリースのタグ付け・back-merge 自動化

- Status: accepted
- Date: 2026-06-20（accepted: 2026-06-21／back-merge を案F→案H に改訂: 2026-06-21）
- Deciders: jun.shiromoto (Joymerrevent)

> 発端：0.2.0 は release PR マージ後に `git tag` → push（→`release.yml` が OIDC publish）、
> さらに main→develop back-merge を**手動**で実施。当初像「マージ → 自動タグ → 自動 publish」
> になっていない。これを自動化したい。

## Context and Problem Statement

現状の手作業：release PR を main にマージ後、(1) `vX.Y.Z` タグ作成・push（→`release.yml` が publish）、
(2) main→develop back-merge、(3) GitHub Release。タグ忘れのリスクが残る。

**落とし穴（GitHub のループ防止仕様）**：

- **落とし穴A：`GITHUB_TOKEN` で push したタグは他のワークフローを起動しない**。素朴な
  「自動でタグ push → タグ起点の `release.yml`」では **publish が走らない**。
- **落とし穴B：`GITHUB_TOKEN` で作成した PR / Release は他のワークフロー/CI を起動しない**。自動で
  back-merge PR を開いても**必須チェックが走らずマージ不能**、ワークフローが作った Release も publish を起動しない。
  （※ 人や CC が `gh release create`／UI で作った Release は**ユーザートークン**なので起動する。）

## Decision Drivers

- 手作業・属人化・**タグ忘れ**を無くす（ADR-0025 の動機）。
- **意図的リリース**（出すタイミングを人が握る・ADR-0025）。
- **トークンレス維持**（OIDC・長期シークレットを増やさない）。
- **PR マージは人が行う**（運用ルール）。
- 上記の落とし穴を回避。

## Considered Options

### タグ＋publish の方式

- **案A：`release.yml` を `push: main` 全自動**。main への push で「version にタグが無ければ tag＋OIDC publish＋GitHub Release」を1ジョブで完結。マージ＝即 publish（追加ゲートなし）。
- **案B：auto-tag ＋ Release イベントで publish**。タグは `push: main` で自動作成。**GitHub Release は人 or CC が作成**（UI または `gh release create`＝意図的ゲート）し、`on: release: published` で OIDC publish。
- **案C：PAT でタグ push**（タグ起点 `release.yml` を維持）。長期シークレットが要る。
- **案D：GitHub App トークン**。堅いが設定コスト。
- **案E：手動継続**。

### back-merge の方式

- **案F：auto-tag ワークフローで develop へ直 push**。ルールセットの bypass actor に Actions ボットを入れ、back-merge（version/CHANGELOG 同期）を PR 無しで直接 push＝完全自動。
- **案G：自動で back-merge PR を開く**。ただし `GITHUB_TOKEN` 製 PR は CI が走らず、close/reopen か admin マージの一手間。
- **案H：手動**（`git merge` 一発）。

## Decision Outcome

**決定：タグ＋publish ＝ 案B（accepted・2026-06-21）、back-merge ＝ 案H・手動（改訂・2026-06-21）。**

> 当初 back-merge は案F（直 push・bypass）としたが、調査により **`GITHUB_TOKEN` は保護ブランチへ
> 直 push できない**と判明（要 GitHub App / PAT）。トークンレス／フェイルセーフ方針に反するため **案H に改訂**。

- **タグ：自動**（`push: main` で version にタグが無ければ作成・push）。
- **Release：人 or CC が作成**（`gh release create`／UI）＝**意図的リリースゲート**。ユーザートークンなので `release: published` を起動する。
- **publish：`release.yml` を `on: release: published` に変更**し OIDC publish。Trusted Publisher は workflow 名 `release.yml` 一致なのでトリガー変更の影響なし。
- **back-merge：手動**（release 後に `git merge` 1ステップ・runbook §2）。設定変更・Secret 追加なし＝完全トークンレスを維持。

理由：タグ忘れを自動で消し、Release 作成という意図的ゲートで「出す時期を人が握る」を保ち、全工程トークンレス。
案A（マージ＝即 publish）より意図的で、Release 作成（どのみちやる作業）が publish の引き金になるためステップも増えない。
back-merge は案F が `GITHUB_TOKEN` で実現不可・完全自動には GitHub App（秘密鍵 Secret＋ruleset 化）が要る＝方針に反するため、低頻度・低リスクの手動（案H）を採る。

### Consequences

実装は**別 PR**：

- **`tag.yml`（新規）**：`on: push: main`。package.json の version にタグが無ければ `vX.Y.Z` を作成・push（タグのみ。back-merge は含めない）。
- **`release.yml`（変更）**：トリガーを `on: push: tags` → **`on: release: published`** に。OIDC publish は維持。
- **back-merge：手動**（runbook §2 の `git merge` 1ステップ）。設定変更・Secret 追加なし＝完全トークンレスを維持。
- **運用**：release PR を main にマージ → tag 自動 → back-merge 手動 → 人/CC が Release 作成 → publish 自動。
- **runbook 更新**：上記フローに。
- 将来：back-merge を完全自動にしたくなったら GitHub App を導入（案F の再評価）。それまでは手動で十分。

## Pros and Cons of the Options

### 案A main-push 全自動

- Good: マージだけで全部完了・トークンレス。
- Bad: 意図的ゲートが「release PR マージ」だけ。Release を workflow（GITHUB_TOKEN）で作ると後段を起動しない制約。

### 案B auto-tag ＋ Release イベント publish（採用）

- Good: タグ自動＋**Release 作成が意図的な publish ゲート**＝deliberate。トークンレス。Release 作成は元々やる作業。
- Bad: Release は**人/CC（ユーザートークン）**が作る必要（GITHUB_TOKEN 製では起動しない）。

### 案C PAT / 案D App

- Good: タグ起点を維持できる。
- Bad: 長期シークレット（PAT）or 設定コスト（App）。

### 案E 手動継続

- Bad: タグ忘れが残る（発端の不満）。

### back-merge（案F 直 push / 案G 自動 PR / 案H 手動＝採用）

- 案F: 完全自動だが **`GITHUB_TOKEN` は保護ブランチへ直 push 不可**＝実現に **GitHub App**（秘密鍵 Secret＋ruleset 化＋bypass 登録）が要る。トークンレス／フェイルセーフ方針に反する。
- 案G: PR で見えるが `GITHUB_TOKEN` 製 PR は CI が走らず一手間。
- **案H（採用）**: 単純・追加ゼロ・完全トークンレス。手作業1ステップだがリリースは低頻度で許容。

## More Information

- 落とし穴の出典：`GITHUB_TOKEN` による push / PR・Release 作成は他のワークフローを連鎖起動しない（GitHub 既知の仕様）。`gh release create` を CLI（ユーザートークン）で実行した場合は起動する。
- back-merge を案H にした根拠：`GITHUB_TOKEN` は保護ブランチへ直 push できない（要 GitHub App / PAT）。出典 [Ninjaneers][s1]／[community #25305][s2]／[Mercari Engineering][s3]。
- 関連: [ADR-0025][adr25]（リリース自動化）／ `release.yml`（OIDC Trusted Publishing）／ [release-runbook][rb]。

[adr25]: 0025-release-automation.md
[rb]: ../release-runbook.md
[s1]: https://medium.com/ninjaneers/letting-github-actions-push-to-protected-branches-a-how-to-57096876850d
[s2]: https://github.com/orgs/community/discussions/25305
[s3]: https://engineering.mercari.com/en/blog/entry/20241217-github-branch-protection/
