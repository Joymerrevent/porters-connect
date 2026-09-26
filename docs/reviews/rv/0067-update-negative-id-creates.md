# RV-67 🔴 `update(-1)` がエラーにならず、新規作成として送られる

- 重要度: 🔴 ／ 観点: フェイルセーフ / API 忠実性
- 状態: open

## 概要

`update` / `updateMany` が id を検査せずに `{Resource}.P_Id` へ書く。PORTERS では `-1` が新規作成を意味するので、更新のつもりの呼び出しがレコードを新しく作る。`0` や `NaN` もそのまま送られる。

## 根拠

- `src/accessor/data-writer.ts:144`（`update`）と `:156`（`updateMany`）が id をそのまま書き込みの項目に入れる。
- [write-format.md][wf] の 31 行目: 「新規作成は `{Resource}.P_Id` に `-1`」。
- 実測（2026-09-26）: `candidate.update(-1, …)` / `update(0, …)` / `update(NaN, …)` はどれも成功（id 100）を返し、送った本文の `P_Id` は `-1` / `0` / `NaN` だった。

## 影響

🔴。`indexOf` の「見つからない」の `-1` などをそのまま渡すと、更新のつもりで重複レコードを作る。削除 API が無いので取り消せない。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `update` / `updateMany` で、id が正の安全な整数であることを送信前に確かめ、外れたら `PortersConfigError` にする。`get` / `getMany` にも同じ検査を入れる（RV-74）。

## 処置

—

[wf]: ../../usage/reference/resource-api/write-format.md
