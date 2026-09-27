# RV-116 🟢 Option の `count` の上限 200 に reference の根拠が無く、hint が無い `searchAll` を勧める

- 重要度: 🟢 ／ 観点: ドキュメント / DX
- 状態: open

## 概要

reference は Option の `count` を「省略時は全アイテム」と書き、200 の上限は書いていない。201 を拒否したときの hint は、Option に無い `searchAll()` を勧める。

## 根拠

- `src/resources/option.ts:74`。実測（サブエージェント）。

## 影響

🟢。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 上限を LV で確かめ、hint を Option に合わせる。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
