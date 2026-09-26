# RV-110 🟢 `base64ToBytes` が不正な入力で、PortersError ではない DOMException を投げる

- 重要度: 🟢 ／ 観点: エラーモデル
- 状態: open

## 概要

`atob` の例外がそのまま出る。

## 根拠

- `src/util/base64.ts:16`。実測（サブエージェント）。

## 影響

🟢。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `PortersConfigError` に包む。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
