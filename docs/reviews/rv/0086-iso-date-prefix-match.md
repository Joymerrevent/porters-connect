# RV-86 🟡 Date の書き込みが前方一致しか見ず、存在しない日付や後ろに続く文字を通す

- 重要度: 🟡 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: fixed

## 概要

`isoToPortersDate` は先頭の `YYYY-MM-DD` だけを見るので、`2026-02-30` や `2026-09-10garbage` を通す。ゾーン付きの値は UTC に直さずに日付だけを取る。

## 根拠

- `src/util/datetime.ts:80`（`isoToPortersDate`）。DateTime 側（28 行目の近く）は 2/30 を退けている。
- `docs/usage/topics/datetime.md` は Date の入力を「日付だけ・時刻もゾーンも無し」と書いている。
- 実測（サブエージェント・2026-09-26）: `"2026-09-10garbage"` は `2026/09/10`、`"2026-09-10T23:00:00-09:00"` は `2026/09/10`（UTC では 9/11）になった。

## 影響

🟡。誤った日付が黙って登録される。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `^(\d{4})-(\d{2})-(\d{2})$` の完全一致にし、暦の上で存在する日付であることを確かめる。

## 処置

**実施（2026-09-26・fix/xml-review・`c6d9c68`）。** `src/util/datetime.ts` の `isoToPortersDate` を、日付だけなら完全一致で暦にある日付に限り、日時の形は DateTime と同じ検査を通して UTC の日付にする形にした（ADR-0038 のとおり、Date の条件も ISO で受ける）。

## 検証

`src/util/datetime.test.ts` の「isoToPortersDate refuses …」「takes the UTC date of a datetime」「accepts a leap day」。
