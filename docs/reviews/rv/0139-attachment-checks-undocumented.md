# RV-139 🟢 添付ファイルの送る前の検査が、利用者向け文書に載っていない

- 重要度: 🟢 ／ 観点: ドキュメント
- 状態: open

## 概要

`resourceId`・`contentType`・`fileName`・`content`（Base64）を送る前に確かめるようになったが、送信前の検査の一覧（`docs/usage/topics/limits.md`）にも `AttachmentCreate` の JSDoc にも書いていない。

## 根拠

- `docs/usage/topics/limits.md`、`src/resources/attachment.ts`。読んだだけ（再レビュー・2026-09-26）。

## 影響

🟢。エラーのメッセージで分かる。

## 検出経緯

2026-09-26 のカスタム項目の宣言と添付ファイルの修正（fix/fields-attachment-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 送信前の検査の一覧と JSDoc に足す。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
