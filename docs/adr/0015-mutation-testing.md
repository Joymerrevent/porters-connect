# 15. ミューテーションテスト（Stryker）でテスト品質を測る

- Status: proposed
- Date: 2026-06-15
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0014][0014] のカバレッジは「実行されたか」を測るが「正しく検証したか」は測れない
> （assertion 無しでも緑＝coverage theater）。テストの**質**を測る手段を決める。`proposed`（議論後に確定）。

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

**提案（推奨）: Stryker を導入。ただし毎 PR 強制にはせず、まず定期/オンデマンドで mutation score を可視化**。

- ツール: **StrykerJS**（`@stryker-mutator/core` ＋ vitest runner）。
- 対象: src のロジック（[ADR-0014][0014] と同様にバレル/型/プレースホルダ/テストを除外）。
- 運用: **初期はレポートのみ**（オンデマンド `pnpm mutation` ＋必要なら nightly CI）。survived mutant を見て
  テストを補強。**score 閾値の CI 強制は段階導入**（数値が安定してから別途）。
- フェイルセーフ: survived は「テストの穴」として扱い、`/* Stryker disable */` の濫用はしない。

### Consequences

- Good: 空テスト/弱い assertion を炙り出せる＝テスト品質を継続的に上げられる。カバレッジの限界を補完。
- Bad: **遅い**（mutant 数だけ test suite を回す）。同値変異（無害な mutant）の survive を手で仕分ける手間。
- Neutral: 毎 PR 強制・score 閾値・CI ゲートは別 ADR/後続で（まずは可視化から）。

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
