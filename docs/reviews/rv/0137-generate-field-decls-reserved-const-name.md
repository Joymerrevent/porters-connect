# RV-137 🟢 generateFieldDecls の constName が予約語でも通り、生成物が構文エラーになる

- 重要度: 🟢 ／ 観点: フェイルセーフ
- 状態: open

## 概要

`constName: "class"` / `"default"` / `"enum"` は識別子の形の検査を通り、生成したファイルが構文エラーになる。

## 根拠

- `src/fields/generate-field-decls.ts` の constName の検査。実測（再レビュー・2026-09-26。TS parser の診断）。

## 影響

🟢。コンパイル時にエラーになるので黙っては通らない。

## 検出経緯

2026-09-26 のカスタム項目の宣言と添付ファイルの修正（fix/fields-attachment-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 予約語の一覧で弾く。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
