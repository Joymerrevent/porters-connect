# RV-3 🟡 ErrorCategory の rateLimit が到達不能

- 重要度: 🟡 ／ 観点: エラーモデル
- 状態: fixed

## 概要

`ErrorCategory` の `"rateLimit"` がどの分類関数からも返されず到達不能。レート超過は強制切断 → `PortersNetworkError`（category `"network"`）になる。README は `e.category` 例に `"rateLimit"` を挙げる

## 根拠

`src/errors/porters-error.ts:11`（定義）/ `src/errors/classify.ts`（未使用）/ `src/http/fetch-transport.ts:29` / `README.md:229`

## 推奨

予約注記／型から削除／強制切断検知に配線 のいずれかで整合させる

## 処置

rateLimit を予約として明示（型はコメント、README 整合）。強制切断は network 継続
