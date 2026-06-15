# 15. ミューテーションテスト（Stryker）でテスト品質を測る

- Status: accepted
- Date: 2026-06-15
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0014][0014] のカバレッジは「実行されたか」を測るが「正しく検証したか」は測れない
> （assertion 無しでも緑＝coverage theater）。テストの**質**を測る手段を決める。`accepted`（2026-06-15）：
> Stryker を導入し、カバレッジ同様に**継続運用・CI で回帰を止める**（score `break` 閾値）。
> PR は差分（incremental）で高速に・nightly でフル。baseline を作り survived を潰して閾値を設定・ratchet。

## Context and Problem Statement

[ADR-0014][0014] で statements/functions/lines=100%・branches=90% を強制したが、**行・分岐カバレッジは
「コードを実行したか」しか測らない**。assertion の弱い/無いテストでも 100% になり得る。テストが**実際に
バグを捕まえられるか**（フェイルセーフの本丸）を測りたい。導入するか・どう運用するかを決める。

## Decision Drivers

- **フェイルセーフ**: テストが本当に回帰を検出できることを担保する。
- **公認品質**: 「意味のあるテスト」を仕組みで裏づける。
- **薄く・現実的**: 遅い手法なので CI を不必要に重くしない。
- **契約なしで回せる**: mock + fixture（[ADR-0002][0002]）のままで実行できる。
- **[ADR-0014][0014] と補完**: カバレッジ＝床（実行）、mutation score＝実力（検証）。

## Considered Options

- **導入しない**（カバレッジのみ）
- **Stryker（StrykerJS）導入**（JS/TS の定番。`>`→`>=`・`&&`→`||`・`??` 削除・`return` 改変等で mutant を生成し
  「テストが倒せるか」を測る）
- 実行頻度: **毎 PR で強制** / **定期（nightly）または手動オンデマンド** / レポートのみ

## Decision Outcome

**採用: Stryker を導入し、テスト品質を継続運用で担保（CI で score 回帰を止める）**。一度きりの計測でなく、
カバレッジ（[ADR-0014][0014]）と同じく「壊れたら CI が落ちる」運用にする。

- ツール: **StrykerJS**（`@stryker-mutator/core` ＋ `@stryker-mutator/vitest-runner`）。
- 対象: src のロジック（[ADR-0014][0014] と同様にバレル/型/プレースホルダ/テストを除外）。
- **CI 強制**: mutation score の `break` 閾値を設け、下回ったら CI を落とす（回帰防止）。
- **実行戦略**: **PR は差分のみ（incremental / `--since`）で高速**に、**nightly（schedule）でフル run** して全体 score を追跡。
- **baseline → ratchet**: 導入時にフル run → survived mutant をテストで潰す → `break` 閾値を実測付近に置き徐々に引き上げる。
- フェイルセーフ: survived は「テストの穴」。`// Stryker disable` は真の同値変異のみに限定（濫用しない）。

### Consequences

- Good: 空テスト/弱い assertion を CI で継続的に弾ける＝テスト品質を維持。カバレッジの限界を補完。
- Bad: **遅い**（mutant 数だけ test suite を回す）→ PR は incremental・full は nightly で緩和。同値変異の仕分けコスト。
- Neutral: `break` 閾値・incremental の基準（`develop`）は実装で確定。score を上げる継続作業が発生（coverage と同性質）。

## Pros and Cons of the Options

### 導入しない

- Good: 追加コストゼロ。
- Bad: テスト質の盲点が残る（coverage theater を検出できない）。

### Stryker 導入（推奨）

- Good: JS/TS 標準・vitest 連携・mutation score で質を定量化。
- Bad: 実行が重い・チューニング（除外・タイムアウト）が要る。

### 実行頻度

- 毎 PR 強制: Good 抜け漏れ無し／Bad CI が重く遅い・初期は不安定。
- 定期/オンデマンド（推奨）: Good 軽い・段階導入／Bad 強制力は弱い（運用で補う）。

## More Information

- 前提/依存: [ADR-0014][0014]（カバレッジは床）、[ADR-0013][0013]（テスト方針）、[ADR-0002][0002]（mock+fixture）。
- 後続: score 閾値の CI 強制（数値安定後）。
- 関連: [[0014-test-coverage-policy]], [[0013-coding-conventions-class-vs-function]]。

[0002]: 0002-ground-design-in-live-api-docs.md
[0013]: 0013-coding-conventions-class-vs-function.md
[0014]: 0014-test-coverage-policy.md
