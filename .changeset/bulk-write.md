---
"@joymerrevent/porters-connect": minor
---

F-4 一括書き込み: 各データ系リソースに `createMany` / `updateMany` を追加（ADR-0041）。
200 件＋サイズで自動分割し、部分成功を `BulkWriteResult` で返す（per-item 失敗は throw しない）。非破壊（追加のみ）。
