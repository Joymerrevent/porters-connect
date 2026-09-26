# RV-97 🟢 `keywords` の空の要素をそのまま送り、長さを UTF-16 の単位で数える

- 重要度: 🟢 ／ 観点: API 忠実性
- 状態: fixed

## 概要

空文字の要素は `",a,"` として送る。長さは UTF-16 の単位で数えるので、絵文字 51 字が 102 字として拒否される（安全側）。

## 根拠

- `src/accessor/append-read-query.ts:144`。実測（サブエージェント）。

## 影響

🟢。安全側か、影響が小さい。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 空の要素を拒否する。長さの数え方は PORTERS の数え方を LV で確かめてから決める。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/accessor-low-review・`30cfcc3`）。** 空文字や空白だけのキーワードを、送る前に拒否する。長さは UTF-16 の単位で数えるまま（長く見積もる側＝安全側）にし、PORTERS の数え方は LV-36 に記録した。

## 検証

`src/accessor/append-read-query.test.ts` の「refuses an empty keyword」と、`pnpm check:lv`。
