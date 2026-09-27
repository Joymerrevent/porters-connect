# RV-84 🟡 入れ子の `P_Id` を検査なしの `Number()` で読み、空は 0、文字は NaN になる

- 重要度: 🟡 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: fixed

## 概要

User・Department・Reference・Link の入れ子の `P_Id` を `Number()` で読むので、空文字は 0（存在しない id）に、文字は NaN になる。

## 根拠

- `src/xml/decode-field.ts:32`・`:48`・`:85`。同じファイルの `numeric()`（119 行）は NaN を渡さないように確かめている。
- 実測（サブエージェント・2026-09-26）: `P_Id` が `""` なら 0、`"abc"` なら NaN になった。

## 影響

🟡。存在しない id 0 を、実在する参照として扱う。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 空は `null` にし、それ以外は `numeric()` を通す。

## 処置

**実施（2026-09-26・fix/xml-review・`dc4f707`）。** `src/xml/decode-field.ts` の `nestedId` で、入れ子の `P_Id` を「空（空白だけを含む）なら null、それ以外は `numeric()`」で読む（User・Department・Reference・Link）。

## 検証

`src/xml/decode-field.test.ts` の「the id inside a nested record (RV-84)」。
