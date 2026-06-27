# 39. commitlint の scope を改訂：リリース PR は範囲限定で実行（案A）＋ feature PR は PR タイトルも lint（案D）

- Status: accepted
- Date: 2026-06-27
- Deciders: jun.shiromoto (Joymerrevent)

> [[0037-commitlint-pr-scope]] は「リリース PR（base=main）で commitlint をスキップ」した。これによりリリース PR は
> **commitlint が一切走らない**＝リリースコミット件名の CI 担保が消えた。本 ADR は 0037 を **superseded** し、二段で塞ぐ：
> **案A**＝スキップをやめ lint 範囲を `origin/develop..HEAD`（develop にまだ無い release 固有コミット）へ絞って**実際に走らせる**／
> **案D**＝feature PR の **PR タイトルも commitlint** してスカッシュ件名漏れを**発生源で**防ぐ。**案A は 0.4.0 で出荷済み・案D は本 ADR で追加採用**。
> **案A＋案D 採用で accepted（2026-06-27）。** 実装は別 PR（ADR 先行）。

## Context and Problem Statement

[[0037-commitlint-pr-scope]] は、リリース PR（`release/X.Y.Z → main`）が **直前リリース以降の develop 全コミットを
再 lint** し、過去のスカッシュ件名（= PR タイトル・当時未検査・共有履歴ゆえ修正不能）の `subject-case` 違反で落ちる
問題に対し、**base=main の PR では commitlint ジョブをスキップ**する解を採った。

これで「過去件名でリリースが止まる」害は消えたが、副作用として **リリース PR では commitlint が一度も走らない**。
`commitlint.yml` の本来の目的は「ローカル `commit-msg` フックは `--no-verify` で飛ばせるため CI でも担保する」こと
であり、**リリースコミット（`chore(release): …`）の件名が CI ゲートを通らなくなった**（ローカルフック頼み）。

さらに根本を見ると、問題の発生源は **スカッシュマージの件名（= PR タイトル）が当時 commitlint 未検査のまま develop に
入る**点にある。0.3.0 リリース PR を落とした `08f798d`（#88 のタイトル "`docs(guide): OAuth …`" が `subject-case` 違反）が
まさにこれ。スキップ（0037）も範囲限定（案A）も **「過去件名でリリースを止めない」対症**であって、**件名漏れの発生自体は
止めない**。

具体的な不満:

- リリース PR の commitlint チェックが **スキップ表示**になり、「CI green でリリース」の中で唯一“走っていない”項目が残る。
- スキップをやめて `main..HEAD` 全体を lint に戻すと、**将来 develop に違反スカッシュ件名が 1 本でも混ざれば次のリリース PR で
  再び修正不能件名で落ちる**（0037 が直した問題の再発）。「たまたま今は範囲が綺麗」依存は fail-safe でない。

## Decision Drivers

- **仕組みで守る（フェイルセーフ）**: リリースコミット件名の CI 担保を**復活**させ、`--no-verify` 抜けを CI で塞ぐ。
- **構造的に落ちない**: 「たまたま範囲が綺麗だから pass」ではなく、**修正不能な過去のスカッシュ件名を範囲に入れない**。
- **発生源を塞ぐ（根治）**: 対症（範囲限定）だけでなく、**件名漏れの入口（PR タイトル）**を検査して再発を止める。
- **再 lint の冗長を排除**＋**単純さ**: develop で既検査のコミットを二度検査しない。複雑な範囲計算は避ける。

## Considered Options

- 案A: **スキップをやめ、release PR では `origin/develop..HEAD` に範囲を絞る**（対症・採用）。
- 案B: 現状維持（[[0037-commitlint-pr-scope]] の一律スキップ）。
- 案C: スキップをやめ `main..HEAD` 全体を lint に戻す（= 0037 以前）。
- 案D: **feature PR で PR タイトルも commitlint**（発生源対策・根治・採用）。案A と排他でなく補完。

## Decision Outcome

**採用: 案A ＋ 案D**（accepted・2026-06-27）。両者は排他でなく補完——案A が「過去件名でリリースを止めない」対症、
案D が「件名漏れを発生源で止める」根治。

**案A**: `commitlint.yml` のジョブ条件 `if: github.event.pull_request.base.ref != 'main'` を外して **リリース PR でも
commitlint を実行**し、lint 範囲を **base=main の PR に限り `origin/develop..HEAD`** に切り替える（feature PR は従来どおり
`base.sha..head.sha`）。release ブランチは develop から派生し、main へ持ち込む“新規”は実質 `chore(release)` 等の **release
固有コミットのみ**。develop の履歴は (a) 各 feature PR で既検査、(b) スカッシュ件名は未検査だが修正不能——なので
**(b) を範囲から外し (a) を二度検査しない**。`origin/develop..HEAD` がその「release 固有コミット」をちょうど指す。
**案A は 0.4.0 リリースで出荷済み**（main / develop 反映済み）。

**案D**: feature PR（base≠main）の **PR タイトルも commitlint** で検査する。スカッシュ件名（= PR タイトル）が規約違反の
まま develop に入る入口を塞ぐ。実装は別 PR で `commitlint.yml` に PR タイトル lint ステップを追加（PR タイトルは
`env:` 経由で渡し、スクリプトインジェクションを避ける）。dependabot の `Bump …` タイトルは `commitlint.config.js` の
`ignores` で除外済みなので、案D でも dependabot PR は赤くならない。

[[0037-commitlint-pr-scope]] は本 ADR の accepted をもって **superseded**（スキップ → 案A＋案D へ更新）。

### Consequences

- Good（案A）: リリース PR で commitlint が**実際に走り**、`chore(release)` 件名を CI で担保（`--no-verify` 抜けを塞ぐ）。
  過去のスカッシュ件名は**構造的に範囲外**なので、将来 develop に違反件名が混ざっても**リリース PR は落ちない**。
  [[0032-monotonic-check-release-scope]] と合わせ「base=main PR の特別扱い」が一貫する。
- Good（案D）: スカッシュ件名漏れを**発生源（PR タイトル）で防ぐ**。今後 develop に入る squash 件名が常に規約準拠になり、
  案A が範囲外にした穴（過去件名の再発）も塞がる。dependabot の `Bump …` は `ignores` で除外済み。
- Bad: feature PR の CI に PR タイトル lint が 1 ステップ増える（軽量）。PR タイトル変更後は再 run / 更新が要る場合がある。
- Neutral: ホットフィックス（`hotfix/* → main`・develop 非派生）では `origin/develop..HEAD` が develop 未取り込みの
  main 側コミットを含みうる（稀・既リリース済みで実質クリーン）。必要なら follow-up で merge-base ベースに精緻化。

## Pros and Cons of the Options

### 案A: スキップ廃止＋ `origin/develop..HEAD` に範囲限定（採用）

- Good: 実際に走って green・リリース件名を担保・過去件名を構造的に除外・再 lint の冗長なし。
- Bad: 単体では**スカッシュ件名漏れの発生は止めない**（案D が補完）。ホットフィックスの範囲はやや緩い（稀）。

### 案B: 現状維持（一律スキップ）

- Good: 変更なし。
- Bad: リリース PR で commitlint が走らない（リリース件名の CI 担保なし・唯一“スキップ”が残る）。

### 案C: `main..HEAD` 全体に戻す

- Good: 最も単純（`if` を消すだけ）。
- Bad: 「たまたま範囲が綺麗」依存。将来の違反スカッシュ件名で**リリースが再び止まる**＝ 0037 が直した問題の再発。fail-safe でない。

### 案D: PR タイトルの commitlint（採用・根治）

- Good: スカッシュ件名漏れを**発生源で防ぐ**。案A の穴（件名漏れの発生）を塞ぐ唯一の根治。
- Bad: feature PR の CI を 1 ステップ増やす。単体では「過去件名でリリースが落ちる」対症にはならない（だから案A と併用）。

## More Information

- 対の決定: [[0037-commitlint-pr-scope]]（本 ADR で superseded）／[[0032-monotonic-check-release-scope]]（単調増加検証を base=main に限定）。
- 起点: 0.3.0 リリース PR #92 の commitlint 失敗（`08f798d`＝#88 スカッシュ件名の `subject-case`）。
- 実装（accepted 後・別 PR）:
  - 案A（出荷済み・0.4.0）: `commitlint.yml` の `if` 撤去＋ base=main 分岐で `--from origin/develop --to HEAD`。
    `pull_request` の workflow は **PR head 側のファイル**が使われるため、現行リリース PR に効かせるには実装を release ブランチ（PR head）にも載せる。
  - 案D（本 ADR で追加・別 PR）: `commitlint.yml` に PR タイトル lint ステップを追加（base≠main・`env:` 経由でタイトルを渡す）。
- 関連: dependabot の `Bump …` 件名は別途 `commitlint.config.js` の `ignores` で除外（PR タイトル lint にも効く）。
