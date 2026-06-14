# 10. リトライ／スロットリングの機構

- Status: accepted
- Date: 2026-06-14
- Deciders: jun.shiromoto (Joymerrevent)

> 方針は [ADR-0006][0006] / [requirements][prd] R-7 で確定（retryable は限定・自前スロットリングで上限内）。
> 本 ADR は**実装方式**（バックオフ／スロットルのアルゴリズムと PoC 範囲）の詳細設計。`accepted`（2026-06-14）：
> スロットル＝token-bucket、リトライ＝**メソッド/操作別の冪等性ガード付き**（`create` はネット不確定で再試行しない）。

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
- **冪等性／安全な Write**: 非冪等操作（`create`＝`P_Id=-1`）を不確定失敗で再試行しない（重複登録を作らない＝フェイルセーフ）。

## Considered Options

- スロットル: 案A **min-spacing**（最小送信間隔）／ 案B **token-bucket**（バースト許容＋平均レート）／ 案C sliding-window カウンタ
- リトライ: 指数バックオフ（`base * 2^n`）＋ full jitter ＋ 最大回数/最大待機の上限
- PoC 範囲: **リトライ＋簡易スロットル同梱** / リトライのみ（スロットルは MVP）

## Decision Outcome

**採用**: 以下で `accepted`。

- **スロットル = token-bucket**（案B）。Read/Write 別バケツ（容量＝各上限、毎秒 上限/60 補充）、**安全率
  ~90%**（実効 ~1800 Read / ~450 Write/min）。バーストを許容しつつ 1 分窓で上限内に収め、自動ページングを
  過度に直列化しない。PoC から薄く同梱。
- **リトライ = 指数バックオフ＋ full jitter**（`base * 2^n`、**最大 ~3 回・総待機 ~30s** の上限）。
- **リトライ対象は メソッド/操作別に冪等性で判定**（フェイルセーフの核）:
  - **Read（GET・冪等）**: Result Code `9` / `302` / ネットワーク失敗 をすべて再試行。
  - **`update`（冪等）**: 同上（`9` / `302` / ネットワーク）を再試行。
  - **`create`（`P_Id=-1`・非冪等）**: **応答が返らない失敗（timeout/切断）では自動再試行しない**。
    `PortersNetworkError`（`retryable: false`）で surface し、hint「登録された可能性あり。重複を確認のうえ再実行を」。
    一方、**サーバが状態を返した `9`（未処理確定）は再試行可**。`302` は安全側で非再試行（surface）。
- トークン失効（`401`/`402`）は本層でなく [トークン ADR][0012]（refresh→1 回再試行）が担当。両者は合成する
  （401→refresh→再送、その再送が `9` なら本層でバックオフ）。

本格チューニング（並行度制御・キュー・single-flight 化・分散実行時の協調、並列 Write リスク
[gotchas][gotchas] への既定低並行度）は **MVP 以降**で状況を見て調整。上限値・安全率・係数は設定で上書き可能にする。

### Consequences

- Good: R-7（良き API 市民）を PoC から満たす。暴走課金を抑止。retryable 判定を [ADR-0006][0006] と共有。
- Good: **冪等性ガード**で `create` の二重登録を防ぐ（不確定失敗は安全に surface＝フェイルセーフ）。
- Bad: token-bucket＋操作別判定で実装がやや増える（min-spacing 比）。単一プロセス前提のため多インスタンス/分散では厳密な上限保証は弱い（MVP で協調）。
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
