# RV-94 🟢 `field` に同じ alias が 2 つあると、`expand` / `image` で素の項目も一緒に送る

- 重要度: 🟢 ／ 観点: API 忠実性
- 状態: open

## 概要

`field` の重複を取り除かないので、展開した項目と素の項目の両方を送る。

## 根拠

- `src/accessor/apply-expand.ts:43`・`src/accessor/apply-image.ts:37` が最初の 1 件だけ置き換える。実測（サブエージェント）。

## 影響

🟢。重複を書くことがまれ。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `field` の重複を先に取り除く。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
