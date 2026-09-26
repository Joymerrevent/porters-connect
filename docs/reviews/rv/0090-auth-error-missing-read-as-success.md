# RV-90 🟢 Authentication の応答に `<Error>` が無いと成功と読む

- 重要度: 🟢 ／ 観点: 認証 / フェイルセーフ
- 状態: fixed

## 概要

`<Error>` が無い・空の応答は `toInt` で 0（成功）になる。2xx であれば 200 以外も成功として扱う。

## 根拠

- `src/xml/parse-authentication.ts:34`。reference は「HTTP が 200 以外はエラー」。実測（サブエージェント）で確かめた。

## 影響

🟢。トークンが欠ければ別の検査で止まる。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- RV-70 の `toInt` の修正と合わせて、`<Error>` を必須にする。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-26・fix/http-auth-low-review・`42d0e6b`）。** `<Error>` が無い・空の応答を成功と読まず、読めない応答（`unknown`）として止める。reference の応答例は 2 種類とも `<Error>` を含む。2xx で 200 以外の status は変えていない（`<Error>` を必須にしたので、認証の応答として成り立たない本文は止まる）。

## 検証

`src/xml/parse-authentication.test.ts` の「refuses a response without an `<Error>` code」。
