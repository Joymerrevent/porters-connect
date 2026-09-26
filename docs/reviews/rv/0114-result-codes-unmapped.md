# RV-114 🟢 Resource のコード 5 と、Authentication のコード 113 が表に無い

- 重要度: 🟢 ／ 観点: エラーモデル
- 状態: open

## 概要

どちらも `unknown` になる（再試行しないので安全側）。テストは reference の表を機械的に読んでいない。

## 根拠

- `src/errors/resource-error.ts:13` の表と、[result-codes.md][rc]。読んだだけ。

## 影響

🟢。安全側。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 表に足し、reference の表と突き合わせるテストを足す。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—

[rc]: ../../usage/reference/resource-api/result-codes.md
