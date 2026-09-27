# RV-145 🟢 PORTERS の本文が無い 3xx の応答で、単発の create と createMany の案内が逆になる

- 重要度: 🟢 ／ 観点: 一貫性
- 状態: open

## 概要

単発の `create` は、本文の無い 3xx を API の手前で止まったとみて「登録された可能性あり」を付けない（ADR-0106）。`createMany` の `knownNotWritten` は 4xx だけを書き込まれていないとみるので、3xx（と 1xx）では「書き込まれた可能性がある」と案内する。

## 根拠

- `src/http/requester.ts` の `outcomeUnknown`、`src/accessor/write-many.ts` の `knownNotWritten`。実測（再レビュー・2026-09-27）。`knownNotWritten` は ADR-0106 より前からある判定。

## 影響

🟢。どちらも安全側に倒れる（重複を作らない）。案内がそろっていないだけ。

## 検出経緯

2026-09-27 の ADR-0106 の実装（feat/adr-0106-unknown-outcome-and-codes）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 一括書き込みの判定も、ADR-0106 の境界（本文の無い 3xx / 4xx は API の手前）にそろえる。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
