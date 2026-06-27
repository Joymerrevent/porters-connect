# 39. リリース PR の commitlint はスキップせず、lint 範囲を「develop に未取り込みの release 固有コミット」に絞る

- Status: proposed
- Date: 2026-06-27
- Deciders: jun.shiromoto (Joymerrevent)

> [[0037-commitlint-pr-scope]] は「リリース PR（base=main）で commitlint をスキップ」した（案A）。これにより
> リリース PR は **commitlint が一切走らない**＝リリースコミット件名の CI 担保が消える。本 ADR は **スキップをやめ、
> 代わりに lint 範囲を `origin/develop..HEAD`（= develop にまだ無い release 固有コミット）へ絞る**ことで、
> 「実際に走って green」かつ「修正不能な過去のスカッシュ件名を二度と再 lint しない」を両立する。ADR-0037 の
> 0037 案C（範囲の動的計算）を、release ブランチが develop から派生する前提に特化して**単純化**したもの。

## Context and Problem Statement

[[0037-commitlint-pr-scope]] は、リリース PR（`release/X.Y.Z → main`）が **直前リリース以降の develop 全コミットを
再 lint** し、過去のスカッシュ件名（= PR タイトル・当時未検査・共有履歴ゆえ修正不能）の `subject-case` 違反で落ちる
問題に対し、**base=main の PR では commitlint ジョブをスキップ**する解（案A）を採った。

これで「過去件名でリリースが止まる」害は消えたが、副作用として **リリース PR では commitlint が一度も走らない**。
`commitlint.yml` の本来の目的は「ローカル `commit-msg` フックは `--no-verify` で飛ばせるため CI でも担保する」こと
であり、**リリースコミット（`chore(release): …`）の件名が CI ゲートを通らなくなった**（ローカルフック頼み）。

実利用の観点での具体的な不満:

- リリース PR の commitlint チェックが **スキップ表示**になり、「CI green でリリース」の中で唯一“走っていない”項目が残る。
- 0.4.0 リリース PR では、`origin/main..release/0.4.0` は 6 コミットで **`commitlint` をかけると 0 problems**（犯人だった
  `08f798d` は 0.3.0 経由で既に main へ取り込み済み＝範囲外）。つまり**今や走らせれば普通に pass する**のに、
  [[0037-commitlint-pr-scope]] の一律スキップがそれを妨げている。

ただし「スキップをやめて `main..HEAD` 全体を lint」に戻すと、**将来 develop に `subject-case` 違反のスカッシュ件名が
1 本でも混ざれば、次のリリース PR で再び修正不能件名で落ちる**（[[0037-commitlint-pr-scope]] が直した問題の再発）。
「たまたま今は範囲が綺麗」に依存する解は fail-safe でない。

## Decision Drivers

- **仕組みで守る（フェイルセーフ）**: リリースコミット件名の CI 担保を**復活**させる。`--no-verify` 抜けを CI で塞ぐ。
- **構造的に落ちない**: 「たまたま範囲が綺麗だから pass」ではなく、**修正不能な過去のスカッシュ件名を範囲に入れない**
  ことを保証する。
- **再 lint の冗長を排除**: develop 取り込み時に各フィーチャー PR で**既検査済み**のコミットを二度検査しない。
- **単純さ**: [[0032-monotonic-check-release-scope]] / [[0037-commitlint-pr-scope]] と同じ「base=main の PR は特別扱い」
  の枠内で、複雑な範囲計算を避ける。

## Considered Options

- 案A: **スキップをやめ、release PR では `origin/develop..HEAD` に範囲を絞る**。（推奨）
- 案B: 現状維持（[[0037-commitlint-pr-scope]] の一律スキップ）。
- 案C: スキップをやめ `main..HEAD` 全体を lint に戻す（= 0037 以前）。
- 案D: PR タイトルも commitlint で検査（スカッシュ件名漏れの発生源対策）。本 ADR と排他でなく、将来 follow-up。

## Decision Outcome

**提案（推奨）: 案A**（accepted 時に確定）。`commitlint.yml` のジョブ条件 `if: github.event.pull_request.base.ref != 'main'` を外して
**リリース PR でも commitlint を実行**し、lint 範囲を **base=main の PR に限り `origin/develop..HEAD`** に切り替える
（feature PR は従来どおり `base.sha..head.sha`）。

理由: release ブランチは develop から派生し、リリース PR が main へ持ち込む“新規”は実質 `chore(release)` 等の
**release 固有コミットのみ**。それ以外（develop の履歴）は (a) 各フィーチャー PR で既検査、(b) スカッシュ件名は
未検査だが修正不能——なので **(b) を範囲から外し、(a) を二度検査しない**のが筋。`origin/develop..HEAD` はこの
「release 固有コミット」をちょうど指す。

[[0037-commitlint-pr-scope]] は本 ADR の accepted をもって **superseded**（スキップ→範囲限定へ更新）。0037 が
follow-up 候補に挙げた**案D（PR タイトル lint）は引き続き別 follow-up**として残す（本 ADR と併用可・排他でない）。

### Consequences

- Good: リリース PR で commitlint が**実際に走り**、`chore(release)` 件名を CI で担保する（`--no-verify` 抜けを塞ぐ）。
  過去のスカッシュ件名は**構造的に範囲外**なので、将来 develop に違反件名が混ざっても**リリース PR は落ちない**
  （その違反は別途 follow-up 案D で発生源を塞ぐ余地）。[[0032-monotonic-check-release-scope]] と合わせ「base=main PR の
  特別扱い」が一貫する。
- Bad: develop に入った**スカッシュ件名漏れは依然 CI では検出されない**（範囲外のため）。根治は案D 待ち。
- Neutral: ホットフィックス（`hotfix/* → main`・develop 非派生）では `origin/develop..HEAD` が develop 未取り込みの
  main 側コミットを含みうる（稀・既リリース済みで実質クリーン）。許容し、必要なら follow-up で merge-base ベースに精緻化。
  実装は `origin/develop` を runner で参照できるよう取得する（`fetch-depth: 0` ＋ 明示 fetch、または merge-base 算出）。

## Pros and Cons of the Options

### 案A: スキップ廃止＋ `origin/develop..HEAD` に範囲限定（推奨）

- Good: 実際に走って green・リリース件名を担保・過去件名を構造的に除外・feature PR は無変更・再 lint の冗長なし。
- Bad: スカッシュ件名漏れは非検出のまま（案D で補完）。ホットフィックスの範囲はやや緩い（稀）。

### 案B: 現状維持（一律スキップ）

- Good: 変更なし。
- Bad: リリース PR で commitlint が走らない（リリース件名の CI 担保なし・唯一“スキップ”が残る）。

### 案C: `main..HEAD` 全体に戻す

- Good: 最も単純（`if` を消すだけ）。0.4.0 は現状 pass。
- Bad: 「たまたま範囲が綺麗」依存。将来の違反スカッシュ件名で**リリースが再び止まる**＝ 0037 が直した問題の再発。fail-safe でない。

### 案D: PR タイトルの commitlint（発生源対策）

- Good: スカッシュ件名漏れを発生源で防ぐ。
- Bad: 本問題（過去件名で落ちる／リリース件名が未担保）の直接解ではない。feature PR の CI を変更。案A と併用する将来 follow-up。

## More Information

- 対の決定: [[0037-commitlint-pr-scope]]（本 ADR で superseded）／[[0032-monotonic-check-release-scope]]（単調増加検証を base=main に限定）。
- 実装（accepted 後・別 PR）: `.github/workflows/commitlint.yml` の `if` 撤去＋ base=main 分岐で `--from origin/develop --to HEAD`。
  `pull_request` の workflow は **PR head 側のファイル**が使われるため、現行 0.4.0 リリース PR に効かせるには
  実装を **release/0.4.0（PR head）にも載せる**必要がある（落とし先は実装 PR で確定）。
- follow-up 候補: 案D（PR タイトルの commitlint）でスカッシュ件名漏れを発生源で塞ぐ。
