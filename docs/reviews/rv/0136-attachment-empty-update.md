# RV-136 🟢 添付ファイルの update が、何も変えない更新と本文を空にする更新を通す

- 重要度: 🟢 ／ 観点: フェイルセーフ
- 状態: fixed

## 概要

`update(5, {})` や、JavaScript からキーを綴り間違えて全項目が `undefined` になった呼び出しは、`<Id>5</Id>` だけを送って成功として id を返す。`update(5, { content: "" })` は既にある本文を空で上書きする。

## 根拠

- `src/resources/attachment.ts` の `update`。実測（再レビュー・2026-09-26）。どちらも RV-81 の修正より前からある振る舞い。

## 影響

🟢。更新されたと誤解させる。本文を空にする更新は、添付ファイルを削除できないので取り消せない。

## 検出経緯

2026-09-26 のカスタム項目の宣言と添付ファイルの修正（fix/fields-attachment-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 項目が 1 つも無い update を拒否する。update の content は空文字を拒否するかを決める。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/fields-attachment-low-review・`8179ef3`）。** 変える項目が 1 つも無い `update` を拒否する。本文を空にする `update`（`content: ""`）は、`create` が 0 バイトのファイルを受けるのとそろえて受ける。

## 検証

`src/resources/attachment.test.ts` の「refuses an update that changes nothing」。
