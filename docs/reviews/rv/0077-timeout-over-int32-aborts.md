# RV-77 🟡 `timeoutMs` に 2^31 以上を渡すと、すべてのリクエストがすぐに中断される

- 重要度: 🟡 ／ 観点: 設定検証
- 状態: open

## 概要

`timeoutMs` の検査は「正の整数」だけで、Node のタイマーの上限（2^31 − 1）を超える値を通す。

## 根拠

- `src/http/fetch-transport.ts:43` の検査と、59 行目の `AbortSignal.timeout(timeoutMs)`。
- [ADR-0077][adr77] の直前のコメントが避けたいとしている形。
- 実測（サブエージェント・2026-09-26）: 2147483647 は通常どおり、2147483648 はすぐ TimeoutError、`Number.MAX_SAFE_INTEGER` は RangeError。どれも `retryable: true` の通信エラーとして再試行された。

## 影響

🟡。設定の誤りが「通信が不安定」に見え、原因にたどり着きにくい。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 上限を `2_147_483_647` にし、超えたら `PortersConfigError` にする。

## 処置

—

[adr77]: ../../adr/0077-fetch-transport-timeout.md
