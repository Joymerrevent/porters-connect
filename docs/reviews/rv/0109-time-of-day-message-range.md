# RV-109 🟢 `encodeTimeOfDay` が `47:59:59` を受け付けるのに、メッセージは `00:00-47:59` と書く

- 重要度: 🟢 ／ 観点: ドキュメント / DX
- 状態: fixed

## 概要

受け付ける範囲とエラーメッセージの範囲が食い違っている。

## 根拠

- `src/util/time-of-day.ts:90` 付近。実測（サブエージェント）。

## 影響

🟢。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- メッセージを受け付ける範囲に合わせる。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/xml-util-low-review・`0263d87`）。** 書き込みと読み込みのメッセージの範囲を「00:00:00-47:59:59」にした。

## 検証

`src/util/time-of-day.test.ts` の「accepts up to 47:59:59 and names that range when refusing」。
