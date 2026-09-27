# RV-74 🟡 `start` と、条件に使う id・空の配列を、送信前に検査していない

- 重要度: 🟡 ／ 観点: フェイルセーフ / 設定検証
- 状態: fixed

## 概要

`count` は 1〜200 を送信前に検査するが、`start` は負の数・小数・NaN をそのまま送る。`or: []` は `P_Id:or=`（空）として、NaN の id は `eq=NaN` として送られる。

## 根拠

- `src/accessor/append-paging.ts:35` が `start` を検査せずに送る。
- 条件の組み立て（`src/accessor/append-read-query.ts`）は空の配列を拒否しない。`get` / `getMany`（`src/accessor/data-reader.ts`）は id を検査しない。
- 実測（サブエージェント・2026-09-26）: 上の値がそのまま URL に入った。PORTERS が空の `or=` を「条件なし」と読むかは確かめていない。

## 影響

🟡。空の `or=` が「条件なし」と読まれれば全件取得になる。ほかは PORTERS 側のエラーになるが、原因が利用者に伝わりにくい。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `start` を 0 以上の整数に限る。条件の `or` / `and` の空配列を拒否する。id は正の整数に限る（RV-67 と同じ検査）。

## 処置

**実施（2026-09-26・fix/accessor-review・`30b8142` / `cc705a0`）。** `get` / `getMany` の id を `assertRecordId` で確かめる。`start` を 0 以上の整数に限る（`src/accessor/append-paging.ts`）。条件の `or` / `and` の空の配列を拒否する（`src/accessor/append-read-query.ts`）。

## 検証

`src/accessor/data-reader.test.ts` の「the id get / getMany receive (RV-74)」、`append-paging.test.ts` の start のガード、`append-read-query.test.ts` の「condition の空の一覧（RV-74）」。
