# RV-89 🟢 `*ExpiresIn` が欠けたときと、数でないときの扱いが揃っていない

- 重要度: 🟢 ／ 観点: 認証
- 状態: fixed

## 概要

欠けた値や秒で来た値では毎回取り直し、`30min` のような数でない値では期限不明として 1 回しか取らない。

## 根拠

- `src/auth/exchange-token.ts:62` 付近。実測（サブエージェント）: 取得の回数は欠け 5 回・秒 5 回・非数 1 回。

## 影響

🟢。PORTERS は常にミリ秒で返すので、起きにくい。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 数でない値も欠けと同じく扱い、取り直す側に倒す。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-26・fix/http-auth-low-review・`42d0e6b`）。** 期限（`*ExpiresIn`）が 10 進の整数でなければ、欠けたのと同じく扱い、期限 0 で取り直す側に倒す。

## 検証

`src/xml/parse-authentication.test.ts` の「reads the ExpiresIn … as missing」。
