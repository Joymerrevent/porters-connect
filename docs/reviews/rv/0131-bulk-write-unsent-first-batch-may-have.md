# RV-131 🟢 一括の create の最初のバッチで、送る前に失敗しても「書き込まれた可能性がある」と書く

- 重要度: 🟢 ／ 観点: エラーモデル
- 状態: fixed

## 概要

最初のバッチでトークンの取得が通信エラーになると（何も送っていない）、元のエラーではなく「records 0–199 may have been written」の一括書き込みのエラーになる。2 つ目以降のバッチでも同じ。

## 根拠

- `src/accessor/write-many.ts` の `knownNotWritten`。実測（2 回目の再レビュー・2026-09-26）: 送信は 0 回だった。

## 影響

🟢。安全側（確かめる手間が増えるだけ）。

## 検出経緯

2026-09-26 の読み書きの共通の仕組みの修正（fix/accessor-review）の 2 回目を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- requester が「送ったかどうか」をエラーに印として残し、それを見る。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/accessor-low-review・`4a00e75`）。** requester が、一度も送らずに失敗したエラーにライブラリの中だけで見える印（`WeakSet`）を付け、`knownNotWritten` がそれを見る。前の試行が送っていれば、再試行でトークンの取得に失敗しても印は付けない。

## 検証

`src/http/requester.test.ts` の「neverSent」と、`write-many.test.ts` の「rethrows a create that never reached the wire as it is」。
