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

**実施（2026-09-27・fix/xml-util-low-review・`1c1378c` → `584db6d`、再レビューを受けて直し直した）。** 書き込みの alias に接頭辞が付いていたら（自分のリソースのものでも）拒否する。最初は「自分の接頭辞なら外してから書く」にしたが、外すのが XML にする段階なので、キー名で見る書き込みの前の検査（id の上書き・画像の上限）を素通りすると再レビューで分かり、拒否に改めた。

## 検証

`src/xml/encode-write-item.test.ts` の「a prefixed alias」と、`src/accessor/data-writer.test.ts` の「a prefixed key never reaches the wire」（update の id・create・画像のいずれも、何も送らずに止まる）。
