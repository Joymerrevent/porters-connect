# RV-96 🟢 `applyExpand` が、alias の組み立てに `qualify()` を使っていない

- 重要度: 🟢 ／ 観点: アーキテクチャ
- 状態: open

## 概要

`util/alias.ts` の「qualify 名を組み立てる場所はすべてこの 1 関数を通す」に反して、`${prefix}.${alias}` を直接組み立てている。

## 根拠

- `src/accessor/apply-expand.ts:21`・`:43`。読んだだけ。今は prefix の無い Phase に参照が無いので表に出ていない。

## 影響

🟢。latent。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `qualify()` を通す。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
