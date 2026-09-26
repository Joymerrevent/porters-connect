# RV-126 🟢 id に BigInt を渡すと、PortersError ではない TypeError が漏れる

- 重要度: 🟢 ／ 観点: エラーモデル
- 状態: fixed

## 概要

`assertRecordId` のメッセージを作る `JSON.stringify` が BigInt を扱えず、`get(10001n)` で素の `TypeError: Do not know how to serialize a BigInt` になる。拒否はされるが、エラーの系統が外れる。

## 根拠

- `src/accessor/assert-record-id.ts` の `shown`。実測（再レビュー・2026-09-26）。

## 影響

🟢。型で止まる（JS から呼んだときだけ）。

## 検出経緯

2026-09-26 の読み書きの共通の仕組みの修正（fix/accessor-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- BigInt も `String()` で書く。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/accessor-low-review・`4c69a3a`）。** メッセージを作るとき、BigInt も `String()` で書く。

## 検証

`src/accessor/assert-record-id.test.ts` の「refuses a BigInt id as a PortersConfigError」。
