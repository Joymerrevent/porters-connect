# RV-105 🟢 書き込みで、接頭辞付きの alias に接頭辞をもう一度付ける

- 重要度: 🟢 ／ 観点: API 忠実性
- 状態: fixed

## 概要

`"Person.P_Name"` を書き込むと `<Person.Person.P_Name>` になる。読み込みでは接頭辞を外すので、扱いが揃っていない。

## 根拠

- 実測（サブエージェント）。

## 影響

🟢。型で止まる。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 接頭辞付きの alias を拒否するか、外してから付ける。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/xml-util-low-review・`1c1378c`）。** 書き込みの alias に自分のリソースの接頭辞が付いていたら外してから付け、型も素の alias で引く。ほかのリソースの接頭辞なら拒否する。

## 検証

`src/xml/encode-write-item.test.ts` の「a prefixed alias」。
