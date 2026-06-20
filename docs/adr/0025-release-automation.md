# 25. CI/CD リリース自動化戦略（version / CHANGELOG / tag / publish）

- Status: accepted
- Date: 2026-06-19（accepted: 2026-06-20）
- Deciders: jun.shiromoto (Joymerrevent)

> **起票のみ（忘備）**。0.1.0 は手運用でリリースし、**0.2.0 以降の自動化方式を本 ADR で決める**。
> 決定は 0.1.0 手動リリース後（その 1 回が手順の検証になる）。本 ADR は論点と選択肢を固定する。

## Context and Problem Statement

0.1.0 までは手運用（`version` 手動 bump・CHANGELOG 手書き・tag 手打ち・publish 手動）。
利用者が増えるほどこれは人手・ミスの温床になり、CI/CD として固定したい（北極星「公認に値する品質／良き API 市民」に直結）。

現状の足場: Conventional Commits・CI（GitHub Actions）・pnpm・ADR 規律あり。**git-flow（develop＋main＋release ブランチ）**で運用中。CHANGELOG は**手書き curated・日本語ファースト**（[CHANGELOG.md][cl]・Keep a Changelog）。

問い: **0.2.0 以降のリリース（version 決定・CHANGELOG 生成・tag・GitHub Release・npm publish）を、どのツール／ブランチ戦略／CHANGELOG 方式／publish 経路で自動化するか。** これらは相互に結合しており（特にツール ⇄ ブランチ戦略 ⇄ CHANGELOG の作り方）、まとめて決める必要がある。

## Decision Drivers

- **CI/CD（人手・ミス削減）**: リリース手順を再現可能にし、手作業を消す。
- **意図的リリース**: 契約ゲートのあるライブラリで、main へ入る度に勝手に publish されるより**出すタイミングを人が握りたい**。
- **CHANGELOG の質**: 日本語ファーストの curated な履歴を保てるか（コミット導出か著述か）。
- **薄く・既存と整合**: GitHub Actions・pnpm・既存 CI に無理なく乗る。重い仕組みは避ける。
- **秘匿/供給網**: `NPM_TOKEN`（CI secret）の管理、npm provenance（来歴）対応。
- **ブランチ戦略との整合**: 多くのリリースツールはトランク/GitHub-flow 前提で、git-flow とは噛み合いが悪い。

## Considered Options

ツール（version/CHANGELOG/tag/release/publish の自動化）:

- **案1 release-please**（Google・CI）: conventional commits から **Release PR を自動維持** → マージで tag＋GitHub Release。人がリリース時期を握れる。CHANGELOG はコミット導出。
- **案2 changesets**: 変更ごとに **changeset ファイル**（bump＋説明文）を PR に入れ、"Version Packages" PR で集約。**説明文を著述＝日本語 curated 維持**。monorepo に強い。per-PR の一手間。
- **案3 semantic-release**: main へ push 毎に **全自動**（解析→bump→CHANGELOG→tag→Release→publish）。強力だが**リリース時期を人が選べない**。
- **案4 最小自前 Action**: `package.json` の version 変化を検知し tag（＋Release/publish）。依存最小・自前保守。
- **案5 手運用継続**: 自動化しない。

ブランチ戦略（ツールと結合）:

- **維持: git-flow**（develop＋main＋release）／ **GitHub-flow**（main＋短命ブランチ）／ **trunk-based**。

CHANGELOG の作り方:

- **コミット導出**（案1/3・日本語コミット文から生成・curation 弱）／ **changeset 著述**（案2・日本語 curated 維持・手間）。

## Decision Outcome

**決定（accepted・2026-06-20）：案2 changesets を採用し、git-flow は維持する。**

日本語 curated CHANGELOG を保ち、出す時期を人が握れる（deliberate）、直近整備した git-flow / Dependabot→develop / 保護ルールを作り替えない、を重視した結果。代償は変更ごとの changeset ファイル 1 枚（許容）。release-please は ceremony 最小だが、CHANGELOG が commit 導出で curation が弱く、GitHub-flow への作り替えを伴うため不採用。semantic-release（全自動 publish）・手運用継続・自前 Action も不採用。

実装・運用は「### Consequences」を参照。以下は決定に至った論点整理（記録）:

- deliberate（出す時期を握る）＋日本語 curated CHANGELOG を重視 → **案2 changesets** か **案1 release-please** が有力。
  - changesets: CHANGELOG を著述できる（日本語・curated）。代償は per-PR の changeset ファイル。
  - release-please: ceremony 最小（Release PR を眺めてマージ）。CHANGELOG はコミット文導出（日本語コミットならそのまま日本語だが curation は弱い）。
- **案3 semantic-release は全自動 publish** ＝契約ゲートの本ライブラリには強すぎる懸念。
- **案4 最小自前 Action** は throwaway 回避になるが保守は自前。**案5 手運用** は頻度が低いうちは可。
- **ブランチ**: 案1〜3 はトランク/GitHub-flow 前提。採用するなら **git-flow → GitHub-flow への簡素化**を併せて検討（本決定の重要サブ論点）。
- **publish/tag**: CI で `pnpm publish`（`NPM_TOKEN` ＋ provenance）。「誰が tag/Release を打つか」は採用ツールが内包する（→ 単独のタグ用 Action は不要になりやすい）。

### 推奨（私案・proposed のまま／決定は stakeholder）

0.1.0–0.1.1 を手運用でリリースした経験と、直近で **git-flow ＋ Dependabot→develop ＋ ブランチ保護**を整備した経緯、
および**日本語 curated CHANGELOG 重視**を踏まえ、次を推奨する（**確定ではない**）。

- **第1候補：案2 changesets（git-flow 維持）。** 理由：
  - CHANGELOG を**日本語で著述・curated 維持**できる（北極星「質」に直結。コミット導出より読み物として強い）。
  - **deliberate**＝"Version Packages" PR をマージした時だけ publish。契約ゲートのある本ライブラリの「出す時期を人が握る」方針に合致。
  - **既存の git-flow を作り替えない**＝直近整備（Dependabot→develop・保護ルール・runbook）を無駄にしない。
  - 代償：単一パッケージで per-PR の changeset ファイルがやや過剰（許容範囲）。
- **対抗：案1 release-please（＋GitHub-flow へ簡素化）。** ceremony 最小を最優先するなら有力。
  代償は**ブランチ戦略の作り替え**と **CHANGELOG が commit 導出＝curation 弱**。GitHub-flow 移行を別途許容できるなら採用価値あり。
- **不採用寄り**：案3 semantic-release（main マージ＝自動 publish＝出す時期を握れない・契約ゲートと不整合）／
  案5 手運用継続（頻度が上がると破綻）。案4 自前 Action は保守コスト。

> この推奨は**私案であり未確定**。stakeholder が議論のうえ決定し、status を accepted に更新する。
> changesets 採用なら git-flow 維持、release-please 採用ならブランチ戦略は別 ADR で GitHub-flow 化を検討。
>
> 決定時に accept へ更新し、選んだ方式に応じて CI ワークフロー・ブランチ運用・CHANGELOG 運用を反映する。
> ブランチ戦略が重くなる場合は**別 ADR に分割**してよい。

### Consequences

- **ツール**: `@changesets/cli` を devDep に追加。`.changeset/` に変更ごとの changeset（bump 種別＋日本語説明）を置く。
- **git-flow との統合**: `baseBranch` は `develop`。フィーチャ PR に `.changeset/*.md` を入れて develop に蓄積 → リリース時に `changeset version`（version bump＋CHANGELOG 生成＋changeset 消費）→ release ブランチ経由で main へマージ → main で `changeset publish`。runbook §2〜3 を changesets ベースに置換する。
- **CHANGELOG**: changesets が生成する形式と、既存の Keep a Changelog 形式（`[Unreleased]`＋日付節）との整合は**最初の `changeset version` 時に確定**する（changesets 形式へ寄せる or custom changelog generator で現行形式を保つ）。＝実装時の小決定。
- **publish/CI**: `changesets/action` ＋ `NPM_TOKEN`（CI secret）＋ npm provenance で「Version Packages PR 維持＋publish」を自動化。**NPM_TOKEN 発行は別途必要**。
- **ブランチ戦略は不変**（git-flow 維持）。GitHub-flow 化はしない。

> 実装フォローアップ: (1) `@changesets/cli` 導入＋設定＋scripts、(2) NPM_TOKEN 発行＋CI secret 登録、(3) `changesets/action` ワークフロー、(4) CHANGELOG 形式の確定、(5) runbook 更新。

## Pros and Cons of the Options

### 案1 release-please

- Good: 人がリリース時期を握れる（Release PR マージ）。tag＋Release 自動。ceremony 最小。
- Bad: CHANGELOG がコミット文導出で curation 弱。git-flow とは要設定。

### 案2 changesets

- Good: CHANGELOG を著述＝日本語 curated 維持。bump 種別が明示的。
- Bad: 変更ごとに changeset ファイルの一手間。単一パッケージにはやや過剰。

### 案3 semantic-release

- Good: 完全自動・設定が定型。
- Bad: リリース時期を人が選べない（main マージ＝publish）。契約ゲートの方針と相性が悪い。

### 案4 最小自前 Action

- Good: 依存最小・throwaway を避けられる。挙動を完全に把握できる。
- Bad: 自前保守。エッジケース（rerun・部分失敗）を自分で面倒見る。

### 案5 手運用継続

- Good: 追加ゼロ・編集自由。
- Bad: 人手・ミス・属人化。頻度が上がると破綻。

## More Information

- 前提/依存: 0.1.0 **手動リリース**（手順の検証材料）、[CHANGELOG.md][cl]（Keep a Changelog・日本語ファースト）、
  Conventional Commits（既存）、CI（`.github/workflows/`）、[roadmap][rm]「リリースに向けた残タスク」。
- 関連プロセス ADR: [ADR-0013][p13]（規約）/ [ADR-0014][p14]（カバレッジ）/ [ADR-0015][p15]（ミューテーション）。
- 結合論点: ブランチ戦略（git-flow ⇄ GitHub-flow）。重くなれば別 ADR 化。
- follow-up: 採用後の `NPM_TOKEN` 設定・npm provenance・(必要なら) Renovate/Dependabot との連携。

[cl]: ../../CHANGELOG.md
[rm]: ../design/roadmap.md
[p13]: 0013-coding-conventions-class-vs-function.md
[p14]: 0014-test-coverage-policy.md
[p15]: 0015-mutation-testing.md
