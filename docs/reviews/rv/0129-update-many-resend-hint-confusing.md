# RV-129 🟢 `updateMany` の途中の失敗の hint が、失敗したバッチを再送してよいのかを読み取りにくい

- 重要度: 🟢 ／ 観点: エラーモデル / DX
- 状態: open

## 概要

`…failed; updates can be resent as they are.` と `Resend only the records that were not written.` が並び、失敗したバッチを再送してよいのかが分かりにくい。

## 根拠

- `src/accessor/write-many.ts` の `batchFailure`。実測（再レビュー・2026-09-26）。

## 影響

🟢。

## 検出経緯

2026-09-26 の読み書きの共通の仕組みの修正（fix/accessor-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- update のときは、最後の文を「失敗したバッチと、まだ送っていないレコードを再送してください」にする。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
