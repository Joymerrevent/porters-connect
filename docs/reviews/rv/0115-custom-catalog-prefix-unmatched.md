# RV-115 🟢 `readCustomCatalog` が、返ってきた行の接頭辞を、頼んだリソースと突き合わせていない

- 重要度: 🟢 ／ 観点: API 忠実性
- 状態: open

## 概要

Job の Field Read が `Person.U_a` を返すと、Job の `U_a` として扱う。

## 根拠

- `src/fields/read-custom-catalog.ts` の `bareAlias` の使い方。実測（サブエージェント）。

## 影響

🟢。番号の取り違え（RV-37 と同じ種類）が起きたときに、黙って別のリソースと比べる。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 接頭辞が頼んだリソースのものでない行はエラーにする。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
