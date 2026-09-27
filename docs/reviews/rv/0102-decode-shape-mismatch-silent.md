# RV-102 🟢 宣言した型と応答の形が違うときに、黙って別の値になる

- 重要度: 🟢 ／ 観点: API 忠実性
- 状態: fixed

## 概要

Option と宣言した項目に User の形が来ると `["User"]` になる。User と宣言した Option の項目は `null` になり、空と区別できない。型の無い項目に配列が来ると `null` になる。

## 根拠

- `src/xml/decode-field.ts:242` ほか。実測（サブエージェント）。

## 影響

🟢。`verifyFields` で型の食い違いに気づける。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 形が合わないときはエラーにする（読み込みの型の検査）。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/xml-util-low-review・`5494f88`）。** Option と宣言した項目に User / Department の形（子要素が `User` / `Department`）が来たら、型の食い違いとして validation のエラーにする。選択肢の alias の書き方は確かめていない（LV-1）ので、それ以外の名前は受ける（`P_` / `U_` / `A_` で始まるかまでは見ない）。User・Department と宣言した項目の中身のタグの違い、型の無い項目の入れ子の値は直していない。前者はコードのコメントで「寛容に扱う」と決めた範囲で、入れ子の形も実機で確かめていない（LV-19 ほか）ので、厳しくすると本物の応答で読み取りがすべて失敗しうる。後者は ADR-0056 の素通し（カタログ外の alias と同じ扱い）に従う。

## 検証

`src/xml/decode-field.test.ts` の「an Option field whose children are not option aliases」。
