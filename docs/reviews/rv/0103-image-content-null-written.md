# RV-103 🟢 Image の書き込みで、`Content: null` を文字列 `null` として送る

- 重要度: 🟢 ／ 観点: フェイルセーフ
- 状態: open

## 概要

型を迂回して `Content: null` を渡すと `<Content>null</Content>` を送る。コメントの「値を作らない」と食い違う。

## 根拠

- `src/xml/encode-field.ts:43`（`imageInner`）。実測（サブエージェント）。

## 影響

🟢。型を迂回したときだけ届く。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `null` の子要素は送らない。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
