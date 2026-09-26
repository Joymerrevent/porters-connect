# RV-79 🟡 `defineFields` が、存在しない Data Type の宣言を受け付ける

- 重要度: 🟡 ／ 観点: フェイルセーフ / 設定検証
- 状態: open

## 概要

`defineFields` は宣言の Data Type を実行時に確かめない。JS から、または型を迂回して不正な型を渡すと、読むと項目が消え、書くと文字列 `undefined` を送る。

## 根拠

- `src/fields/define-fields.ts:143` が `fieldDef.dataType` を確かめずに入れる。`tenant()` は宣言を検証済みとして扱う。
- `defineFields` の JSDoc は「This is the validation boundary」。[ADR-0092][adr92] は JS の呼び出し側を守る方針。
- 実測（2026-09-26）: `{ U_x: { dataType: "Bogus" } }` を渡すと `defineFields` は受け付けた。サブエージェントの実測では、読むと結果から `U_x` が消え、書くと `<Person.U_x>undefined</Person.U_x>` が送られた。

## 影響

🟡。宣言の誤りが、読み書きの結果に黙って紛れ込む。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `defineFields` で、宣言がオブジェクトであることと、Data Type が `CUSTOM_DATA_TYPES` にあることを確かめる。
- あわせて、読み書きの Data Type ごとの switch に、知らない型で投げる分岐を足す。

## 処置

—

[adr92]: ../../adr/0092-reject-unknown-options.md
