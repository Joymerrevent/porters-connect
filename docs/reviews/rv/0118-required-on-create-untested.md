# RV-118 🟢 新規必須の項目を reference と突き合わせるテストが無い

- 重要度: 🟢 ／ 観点: テスト厳密性
- 状態: fixed

## 概要

`reference-catalog.test.ts` は項目と Data Type を突き合わせるが、`REQUIRED_ON_CREATE` は見ていない。今回の実測では 12 件とも一致した。

## 根拠

- 実測（サブエージェント）: reference の「新規必須」列と 12 リソースの `REQUIRED_ON_CREATE` を突き合わせた。

## 影響

🟢。今は一致している。reference を取り直したときに食い違いに気づけない。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 突き合わせをテストにする。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/fields-attachment-low-review・`8faa9a1`）。** 各リソースの必須の一覧を `*_REQUIRED_ON_CREATE` として export し（公開 API ではない）、reference の「新規必須」（●）と 12 種を突き合わせるテストを足した。ID の項目と、Phase の `Resource`（ライブラリが入れる）は数えない。

## 検証

`test/integration/reference-catalog.test.ts` の「reference ↔ 新規必須」（12 種とも一致）。
