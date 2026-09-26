# RV-104 🟢 Option の書き込みで `[null]` を `<null/>` として送り、`x:y` の形の alias を通す

- 重要度: 🟢 ／ 観点: フェイルセーフ
- 状態: open

## 概要

`[null]` は `<null/>`、`[undefined]` は `<undefined/>` になる。名前空間の宣言の無い `x:y` が要素名の検査を通る。

## 根拠

- `src/xml/encode-field.ts:113`（`assertTagName`）。実測（サブエージェント）。

## 影響

🟢。型を迂回したときだけ届く。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 要素名の検査でコロンを拒否し、`null` / `undefined` を拒否する。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
