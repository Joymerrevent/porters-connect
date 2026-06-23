# 37. commitlint CI はフィーチャー PR に限定し、リリース PR（base=main）ではスキップする

- Status: proposed
- Date: 2026-06-23
- Deciders: jun.shiromoto (Joymerrevent)

> リリース PR（`release/* → main`）の commitlint が、**0.x.y 以降の develop 全コミットを再 lint** し、過去の
> スカッシュ件名の `subject-case` 違反で落ちる。[[0032-monotonic-check-release-scope]]（単調増加検証を base=main に限定）と
> 対になる scope 調整。`proposed`（議論用）。

## Context and Problem Statement

`commitlint.yml` は PR の `base.sha..head.sha` を lint する。

- **フィーチャー PR（base=`develop`）**: 新規コミットだけを検査＝本来の目的どおり（`--no-verify` でローカルフックを
  飛ばしても CI で担保）。
- **リリース PR（base=`main`・`release/X.Y.Z → main`）**: 直前リリース以降の **develop 全コミットを再 lint** する。
  これらは (a) develop 取り込み時に各フィーチャー PR で**既に commitlint 済み**、(b) ただし**スカッシュマージの件名
  （＝ PR タイトル）は当時 commitlint で検査されず**履歴に入りうる。(b) がリリース PR で初めて検出され、しかも
  **共有履歴ゆえ件名を修正できない**（rewrite 不可）。

実例: **0.3.0 リリース PR #92** で `08f798d`（#88 のスカッシュ件名「`docs(guide): OAuth 認証ガイド…`」が
`OAuth` 大文字始まり＝`subject-case` 違反）が検出され commitlint が失敗した。リリース内容（型・テスト・ビルド）は健全で、
他チェックは pass。落ちるのは**過去の確定済み件名**のためで、リリースをブロックする理由がない。

[[0032-monotonic-check-release-scope]] が「単調増加検証は base=main の PR で意味がある」と scope を絞ったのと、
**同じ『base=main の PR は特別扱いが要る』問題**の別チェック版である。

## Decision Drivers

- **仕組みで守る（フェイルセーフ）**が、**修正不能な過去件名でリリースを妨げない**。
- commitlint の本来の目的は**新規コミットのゲート**（フィーチャー PR）。リリース PR の中身は既検査の確定コミット。
- 再 lint の**冗長を排除**し、ノイズで CI を赤くしない。
- スカッシュ件名漏れ（PR タイトル起因）は**別手段で塞ぐ**余地を残す。

## Considered Options

- 案A: **commitlint CI を base≠main の PR でのみ実行**（リリース PR ではジョブをスキップ）。（推奨）
- 案B: 現状維持。リリース PR の commitlint 赤は非必須チェックとして許容。
- 案C: lint 範囲を「develop に未取り込みの新規コミットのみ」に動的計算して絞る。
- 案D: **PR タイトルも commitlint** で検査（スカッシュ件名漏れの根本対策）。本 ADR と排他でない（将来 follow-up 可）。

## Decision Outcome

**採用（提案）: 案A**。`commitlint.yml` のジョブ条件に `if: github.event.pull_request.base.ref != 'main'` を付け、
**リリース PR（base=main）では commitlint をスキップ**する。リリース PR の中身は「フィーチャー PR で既検査の確定
コミット」＋「ローカル commit-msg フックで検査済みのリリースコミット」のみなので、CI 再検査の価値が低く、過去件名で
落ちる害の方が大きい。

スカッシュ件名漏れの根本対策（案D＝PR タイトル lint）は**別 follow-up**とし、本 ADR では scope 限定に留める。
案C は実装が複雑で、base=main を一律除外する案A で十分。

### Consequences

- Good: リリース PR が過去のスカッシュ件名で落ちなくなる。commitlint は新規コミットを実際に防げる場（フィーチャー
  PR）で機能し続ける。[[0032-monotonic-check-release-scope]] と合わせ「base=main PR の特別扱い」が整理される。
- Bad: リリースコミット自体の件名は CI では検査されない（ローカル commit-msg フックで担保）。ホットフィックス
  （`hotfix/* → main`）の新規コミットも CI commitlint を通らない（稀・レビューとローカルフックで担保）。
- Neutral: スカッシュ件名漏れは残課題（案D で将来対応可）。本リリース #92 はこの変更取り込み後に commitlint が
  スキップされ green になる。

## Pros and Cons of the Options

### 案A: base≠main でのみ実行（推奨）

- Good: 1 行で済む・意図が明確・[[0032-monotonic-check-release-scope]] と整合。リリース PR を不能件名で止めない。
- Bad: リリース／ホットフィックスの新規コミット件名は CI 非対象（ローカルフックで担保）。

### 案B: 現状維持（赤を許容）

- Good: 変更なし。
- Bad: リリースのたびに赤チェックが出てノイズ。「CI green でリリース」が崩れる。

### 案C: lint 範囲の動的計算

- Good: フィーチャー/リリースを区別せず新規分だけ検査。
- Bad: 範囲計算が複雑・壊れやすい。base=main 除外（案A）で目的は足りる。

### 案D: PR タイトルの commitlint（root 対策）

- Good: スカッシュ件名漏れを発生源で防げる。
- Bad: 本問題（過去件名で落ちる）の直接解にはならない。案A と併用する将来 follow-up。

## More Information

- 起点: 0.3.0 リリース PR #92 の commitlint 失敗（`08f798d`＝#88 スカッシュ件名の `subject-case`）。
- 対の決定: [[0032-monotonic-check-release-scope]]（単調増加検証を base=main に限定）。
- 実装（accepted 後・別 PR）: `.github/workflows/commitlint.yml` に `if: github.event.pull_request.base.ref != 'main'`。
- follow-up 候補: PR タイトルの commitlint（案D）でスカッシュ件名漏れを発生源で防ぐ。
