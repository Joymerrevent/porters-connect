# RV-112 🟢 カスタム項目の alias の文字を確かめていない

- 重要度: 🟢 ／ 観点: 設定検証
- 状態: fixed

## 概要

`/^[UA]_/` だけを見るので、`U_`（名前が空）や、`,`・`:`・`.` を含む alias を通す。`"U_a,Person.P_Memo"` を `field` に入れると、別の標準項目を要求した。

## 根拠

- `src/porters/custom-field.ts:4`。実測（サブエージェント）。

## 影響

🟢。PORTERS が alias に使える文字は確かめていない。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- alias を英数字と `_` に限る。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/fields-attachment-low-review・`1bf6ae3`）。** 宣言の alias は、名前が空、または `,` `:` `=` `.` `(` `)` 空白を含むものを拒否する（`CUSTOM_ALIAS_PATTERN`）。`[Name]` に使える文字は reference が決めていないので、英数字と `_` に限る推奨は採らず、書き方を壊す文字だけにした。Field Read の行から見分けるのは接頭辞だけ（`CUSTOM_ALIAS_PREFIX`）にし、変わった文字の alias を黙って読み飛ばさない。

## 検証

`src/porters/custom-field.test.ts` と `src/fields/assert-declared-catalogs.test.ts` の「assertCustomAlias refuses …」。
