# 29. リリースのタグ付け・back-merge 自動化

- Status: proposed
- Date: 2026-06-20
- Deciders: jun.shiromoto (Joymerrevent)

> 発端：0.2.0 は release PR マージ後に `git tag` → push（→`release.yml` が OIDC publish）、
> さらに main→develop back-merge を**手動**で実施。当初像「マージ → 自動タグ → 自動 publish」
> になっていない。これを自動化したい。

## Context and Problem Statement

現状の手作業：release PR を main にマージ後、(1) `vX.Y.Z` タグ作成・push（→`release.yml` が publish）、
(2) main→develop back-merge、(3) GitHub Release。タグ忘れのリスクが残る。

**落とし穴2点（GitHub のループ防止仕様）**：

- **落とし穴A：`GITHUB_TOKEN` で push したタグは他のワークフローを起動しない**。素朴な
  「自動でタグ push → タグ起点の `release.yml`」では **publish が走らない**。
- **落とし穴B：`GITHUB_TOKEN` で作成した PR は CI を起動しない**。自動で back-merge PR を開いても
  **必須チェック（ci/stryker）が走らずマージ不能**になる。

## Decision Drivers

- 手作業・属人化・**タグ忘れ**を無くす（ADR-0025 の動機）。
- **トークンレス維持**（OIDC・長期シークレットを増やさない）。
- **PR マージは人が行う**（運用ルール）。
- 上記の落とし穴を回避。

## Considered Options

### タグ＋publish の方式

- **案A：`release.yml` を `push: main` 起点に再構成**。main への push で「version にタグが無ければ
  tag 作成＋OIDC publish＋GitHub Release」を**1ジョブで完結**。タグ起点に依存しない＝落とし穴A を回避・トークン不要。
- **案B：PAT でタグ push**（タグ起点 `release.yml` を維持）。長期シークレットが要る（方針に逆行）。
- **案C：GitHub App トークンでタグ push**。堅いが設定コスト。
- **案D：手動継続**。

### back-merge の方式（落とし穴B あり）

- **案E：自動で main→develop PR を開く**＋メンテナがマージ。ただし `GITHUB_TOKEN` 製 PR は CI が走らず、
  close/reopen で CI 起動 or admin マージの一手間が要る。
- **案F：back-merge は手動のまま**（`git merge` 一発）。頻度が低いので許容。
- **案G：App/PAT で PR を開き CI も起動**。トークンが要る。

## Decision Outcome

未決（proposed）。

### 推奨（私案）

- **タグ＋publish → 案A**：`release.yml` を main-push 起点に再構成し、新 version 検知時に
  tag＋OIDC publish＋GitHub Release を1ジョブ化。タグ忘れが構造的に消え、トークンレスも保てる。
- **back-merge → 案F（当面・手動）**：自動 PR は落とし穴B の一手間が増えるため、まずは手動（runbook の1ステップ）
  のまま。将来 App トークンを入れたら案E/G に昇格。

「最大の痛点（タグ忘れ）はトークンレスで自動化、back-merge は無理に自動化しない」。薄く・堅く。

> 決定後 accepted にし、実装（`release.yml` の再構成）は別 PR。npm 側 Trusted Publisher は
> workflow ファイル名（`release.yml`）一致で判定するため、トリガー変更の影響はない。

### Consequences

- （決定後に記入）

## Pros and Cons of the Options

### 案A release.yml を main-push 起点

- Good: トークン不要・タグ忘れ消滅・1フロー。タグ起点の落とし穴Aを回避。
- Bad: 「タグ push がトリガー」という直感から外れる。version 検知ロジックが要る（タグ有無を見る）。

### 案B PAT でタグ push

- Good: タグ起点 `release.yml` を維持できる。
- Bad: 長期シークレット（漏洩・ローテーション）。OIDC でトークンレス化した方針に逆行。

### 案C GitHub App

- Good: 堅い・スコープ最小。
- Bad: App 作成・鍵管理の設定コスト。ソロには重い。

### 案D 手動継続

- Good: 追加ゼロ。
- Bad: タグ忘れが残る（発端の不満）。

## More Information

- 落とし穴の出典：`GITHUB_TOKEN` による push / PR 作成は他のワークフローを連鎖起動しない（GitHub 既知の仕様）。
- 関連: [ADR-0025][adr25]（リリース自動化）／ `release.yml`（OIDC Trusted Publishing）／ [release-runbook][rb]。

[adr25]: 0025-release-automation.md
[rb]: ../release-runbook.md
