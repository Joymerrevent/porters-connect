# 10. リトライ／スロットリングの機構

- Status: proposed
- Date: 2026-06-14
- Deciders: jun.shiromoto (Joymerrevent)

> 方針は [ADR-0006][0006] / [requirements][prd] R-7 で確定（retryable は限定・自前スロットリングで上限内）。
> 本 ADR は**実装方式**（バックオフ／スロットルのアルゴリズムと PoC 範囲）の詳細設計。`proposed`。

## Context and Problem Statement

PORTERS は[gotchas][gotchas] / [result-codes][rc] の通り:

- **レート上限（1 分）**: Read **2000** / Write **500**。超過すると**強制切断**（429 も `Retry-After` も無い）。
- **課金はアクセス数ベース**＝ループ暴走がそのまま課金。無駄打ちを避ける。
- **リトライ可**は Result Code **9**（一時利用不可）・**302**（トランザクション/対象削除）・**ネットワーク**（切断/タイムアウト）。
  入力系（100 系）・権限系は不可（[ADR-0006][0006] の表）。トークン失効（401/402）は[トークン ADR][0012]側で自動回復。

「良き API 市民」（公認の条件・[requirements][prd] 目標2）を満たす、バックオフとスロットルの実装方式を決める。

## Decision Drivers

- **良き API 市民／フェイルセーフ**: 上限内に収める・暴走しない・安全側へ。
- **薄く**: 自前軽量、過剰なキュー機構を持ち込まない。
- **[ADR-0006][0006] と整合**: retryable の判定軸を再利用。
- **PoC で価値**: R-7 は P0。PoC から最低限満たしたい。

## Considered Options

- スロットル: 案A **min-spacing**（最小送信間隔）／ 案B **token-bucket**（バースト許容＋平均レート）／ 案C sliding-window カウンタ
- リトライ: 指数バックオフ（`base * 2^n`）＋ full jitter ＋ 最大回数/最大待機の上限
- PoC 範囲: **リトライ＋簡易スロットル同梱** / リトライのみ（スロットルは MVP）

## Decision Outcome

**提案（推奨）: リトライ＝指数バックオフ＋ full jitter（最大回数・最大待機で上限）、対象は Result Code 9/302・
ネットワーク。スロットル＝簡易（案A min-spacing もしくは軽量 案B token-bucket）を Read/Write 別に、
安全率（例: 上限の ~90%）で。PoC から薄く同梱**。

本格チューニング（並行度制御・キュー・single-flight 化・分散実行時の協調）は MVP 以降。
並列 Write リスク（[gotchas][gotchas]）への既定低並行度も MVP で扱う。

### Consequences

- Good: R-7（良き API 市民）を PoC から満たす。暴走課金を抑止。retryable 判定を [ADR-0006][0006] と共有。
- Bad: 簡易スロットルは多インスタンス/分散では厳密な上限保証が弱い（単一プロセス前提）。
- Neutral: バックオフ係数・上限・安全率は実装時に既定値を置き、設定で上書き可能にする。

## Pros and Cons of the Options

### スロットル 案A: min-spacing

- Good: 実装最小・予測可能（毎送信に最小間隔）。
- Bad: バースト許容が無く、まとめ処理でやや遅い。

### スロットル 案B: token-bucket

- Good: バースト許容＋平均レート制御で実運用に近い。
- Bad: 実装が少し増える（補充タイマ/残量管理）。

### スロットル 案C: sliding-window カウンタ

- Good: 1 分窓に厳密。
- Bad: 窓管理が重く、v1 には過剰。

## More Information

- 前提/依存: [ADR-0006][0006]（retryable 判定）、[result-codes][rc]、[gotchas][gotchas]（上限・429 無し）、[requirements][prd]（R-7）、[HTTP トランスポート ADR][0009]。
- 後続（MVP）: 並行度制御・single-flight・分散協調。
- 関連: [[0006-error-model]], [[0009-http-transport]]。

[prd]: ../design/requirements.md
[gotchas]: ../reference/gotchas.md
[rc]: ../reference/resource-api/result-codes.md
[0006]: 0006-error-model.md
[0009]: 0009-http-transport.md
[0012]: 0012-token-cache-refresh.md
