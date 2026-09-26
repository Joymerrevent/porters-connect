# RV-98 🟢 Image の検査が、型を迂回した値や改行入りの Base64 を正しく扱わない

- 重要度: 🟢 ／ 観点: フェイルセーフ
- 状態: fixed

## 概要

`Content` が文字列でない値や、`FileName` / `ContentType` の無い値は検査を通る。改行入りの Base64 は大きめに見積もられ、ちょうど 2MB でも拒否される（安全側）。

## 根拠

- `src/accessor/guard-image-write.ts:60` 付近。実測（サブエージェント）。型を迂回したときだけ届く。

## 影響

🟢。型で止まる。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `Content` が文字列であることと、3 つの子要素があることを確かめる。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/accessor-low-review・`3f86913`）。** 画像の値の `FileName` / `ContentType` / `Content` がすべて文字列であることを確かめる（空文字は、PORTERS の扱いが未確認なだけなので止めない）。大きさは、改行・タブ・半角スペースを除いてから数える。

## 検証

`src/accessor/guard-image-write.test.ts` の「refuses … before sending」「measures Base64 with line breaks by its content only」。
