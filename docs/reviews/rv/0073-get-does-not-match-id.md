# RV-73 🟡 `get` と `attachment.get` が、返ってきたレコードの id を確かめない

- 重要度: 🟡 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: fixed

## 概要

`get` は応答の 1 件目をそのまま返す。条件が効かずに別のレコードが返っても気づかない。`getMany` は確かめているので、扱いが揃っていない。

## 根拠

- `src/accessor/data-reader.ts:178` と `src/resources/attachment.ts:247` が `page.items[0]` を返す。
- `getMany` の hint は「`get()` で 1 件ずつ読んで」と案内しており、確かめない経路へ誘導している。
- 実測（サブエージェント・2026-09-26）: 応答が id 999 を返すと `get(1)` は id 999 のレコードを返した。`attachment.get(900)` は id 111 の添付を本体付きで返した。添付ファイルの `id` の指定が効くかは LV-24 で未確認。

## 影響

🟡。別のレコードを、頼んだレコードとして扱う。添付ファイルでは別の本体を返す。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `get` でも `getMany` と同じ突き合わせ（頼んだ id と一致するレコードだけを返し、別の id が返ったらエラー）を通す。

## 処置

**実施（2026-09-26・fix/accessor-review・`f7fe10c`）。** `get` と添付ファイルの `get` が、`getMany` と同じ `recordsById` の突き合わせを通す（エラーは `get` の名前と hint で届く）。添付ファイルの `id` の指定が効くかは LV-24 で未確認のまま。

## 検証

`src/accessor/data-reader.test.ts` の「get checks the record it got back (RV-73)」と、`src/resources/attachment.test.ts` の「get checks the attachment it got back」。評価用の例（`examples/offline-sandbox.ts`）の偽の応答も、`get` の条件に合う 1 件だけを返す形に直した。
