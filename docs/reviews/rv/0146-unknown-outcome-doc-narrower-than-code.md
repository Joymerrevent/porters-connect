# RV-146 🟢 結果の分からない create の文書が、実装より狭い範囲しか書いていない

- 重要度: 🟢 ／ 観点: ドキュメント
- 状態: fixed

## 概要

`docs/usage/topics/errors.md` と changeset は、対象を「Code 1000、表に無いコード、HTTP 200 で本文が読めない応答」と書くが、実装は 200 以外の 2xx、4xx / 5xx に載った Code 1000 や表に無いコード、Item が 0 件・複数件の応答も含む。

## 根拠

- `src/http/requester.ts` の `outcomeUnknown`。実測（再レビュー・2026-09-27）。

## 影響

🟢。文書が狭く書いているだけで、利用者を誤らせる向きではない。

## 検出経緯

2026-09-27 の ADR-0106 の実装（feat/adr-0106-unknown-outcome-and-codes）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 文書の書き方を「PORTERS が処理しなかったと言っていない失敗（…など）」のように、例示の形にする。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/review-followup-low・`93abd98`）。** `docs/usage/topics/errors.md` の範囲を「PORTERS が処理しなかったと言っていない失敗（Code 1000・表に無いコード・HTTP 2xx で本文が読めない応答など）」の例示の形にした。

## 検証

文書の記述（`check:usage` が通る）。
