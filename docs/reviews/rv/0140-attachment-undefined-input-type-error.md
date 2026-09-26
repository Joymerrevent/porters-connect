# RV-140 🟢 添付ファイルの create / update に入力そのものを渡し忘れると TypeError になる

- 重要度: 🟢 ／ 観点: エラーモデル
- 状態: open

## 概要

`create(undefined)` / `update(5, undefined)` は `PortersConfigError` でなく `TypeError` で reject する。

## 根拠

- `src/resources/attachment.ts`。実測（再レビュー・2026-09-26）。RV-81 の修正より前からある振る舞い。

## 影響

🟢。送る前に止まるので安全側。エラーの種類で振り分ける利用者には分かりにくい。

## 検出経緯

2026-09-26 のカスタム項目の宣言と添付ファイルの修正（fix/fields-attachment-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 入力がオブジェクトでなければ `PortersConfigError` にする。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
