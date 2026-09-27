# RV-135 🟢 添付ファイルの `Id`・検索の条件の数・文字列の "NaN" は、まだ検査していない

- 重要度: 🟢 ／ 観点: フェイルセーフ
- 状態: fixed

## 概要

添付ファイルの読み取りの `numOrNull` は `<Id/>` を 0 と読む。検索の条件の数（NaN）は `String(value)` のまま送る。Number の項目に文字列の `"NaN"` を渡すと、そのまま書き込まれる。

## 根拠

- `src/resources/attachment.ts`、`src/accessor/append-read-query.ts`、`src/xml/encode-field.ts`。実測・読んだだけ（再レビュー・2026-09-26）。

## 影響

🟢。型で止まるか、PORTERS 側のエラーになるとみられる。

## 検出経緯

2026-09-26 の応答の読み方と書き込みの値の修正（fix/xml-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 同じ検査（数は 10 進の表記、id は整数）を、これらの経路にも通す。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/fields-attachment-low-review・`8179ef3・ccdc901`）。** 添付ファイルの応答の `Id` / `Resource` / `ResourceId` は、空なら null、数でなければ読めない応答にする。検索の条件の `Number` / `System[Id]` の値（`or` の一覧の要素も）は、10 進の表記と 0 以上の id だけを送る（最初は 1 以上にしたが、範囲の条件 `ge: 0` を誤って拒否すると再レビューで分かり、0 以上にした）。書き込みの `Number` の項目に文字列（`"NaN"` など）を渡した場合は直していない。RV-36 の案 3（変換を持たない型は素通しにし、PORTERS が弾くものは手前で弾かない）の決定に従う。

## 検証

`src/resources/attachment.test.ts` の「reads an empty Id as null …」と、`src/accessor/append-read-query.test.ts` の「appendReadQuery — numbers in a condition」。
