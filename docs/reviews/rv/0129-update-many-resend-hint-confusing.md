# RV-129 🟢 `updateMany` の途中の失敗の hint が、失敗したバッチを再送してよいのかを読み取りにくい

- 重要度: 🟢 ／ 観点: エラーモデル / DX
- 状態: fixed

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

**実施（2026-09-27・fix/accessor-low-review・`4a00e75`）。** update が途中で止まったときの hint を「The records … failed. … Updates can be resent as they are: resend the failed batch, the records not sent, and any earlier record that failed.」にした。

## 検証

`src/accessor/write-many.test.ts` の「tells an update that failed midway it can be resent」。
