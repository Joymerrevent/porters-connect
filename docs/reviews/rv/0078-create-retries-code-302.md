# RV-78 🟡 `create` の応答が Code 302 のとき、自動で再送する（ADR-0010 と食い違う）

- 重要度: 🟡 ／ 観点: エラーモデル / フェイルセーフ
- 状態: open

## 概要

Code 302（トランザクションエラー / 対象削除済み）は `transient` に分類され、`create` でも再送される。

## 根拠

- `src/errors/resource-error.ts` で 302 は `transient`（`retryable: true`）。`src/http/requester.ts` の `recoveryFor` は、送信済みの非冪等な書き込みでも通信エラー以外は再送する。
- [ADR-0010][adr10]: 「`302` は安全側で非再試行（surface）」。一方 [result-codes.md][rc] は 302 を「再試行する」としている。
- 実測（サブエージェント・2026-09-26）: `create` の応答を Code 302 にすると 4 回送った。

## 影響

🟡。302 の `create` が実は登録済みだった場合、再送が重複を作る。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- **要 ADR**（ADR-0103 で起票）。ADR-0010 の決定（`create` の 302 は再送しない）に実装を合わせるか、決定を変えるかを決める。

## 処置

—

[adr10]: ../../adr/0010-retry-throttle.md
[rc]: ../../usage/reference/resource-api/result-codes.md
