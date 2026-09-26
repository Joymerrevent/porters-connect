# RV-69 🔴 `createMany` が途中のバッチで失敗すると、それまでのバッチの 1 件ごとの失敗が消える

- 重要度: 🔴 ／ 観点: エラーモデル / フェイルセーフ
- 状態: fixed

## 概要

2 つ目以降のバッチが失敗して例外になるとき、例外にはそれまでのバッチの 1 件ごとの結果（`results`）が付かない。hint は「〜件は書き込み済み」と言うが、その数は送った件数で、成功した件数ではない。

## 根拠

- `src/accessor/write-many.ts:102` の hint が、送った件数を「already written」と書き、その index 以降だけを再送するよう案内する。
- `src/accessor/write-many.ts:154`: 応答の件数が合わないときの例外は、進み具合も `results` も持たず `category: "unknown"` だけになる。
- [ADR-0041][adr41] SD-4 は途中で失敗したときに進み具合を示すと決めている。
- 実測（2026-09-26）: 250 件の `createMany` で、1 つ目のバッチの index 0 を Code 107 で失敗させ、2 つ目のバッチを HTTP 500 にした。例外の hint は「135 record(s) … were already written; retry only the records from index 135 onward」で、例外に `results` は無かった。

- 追記（2026-09-26・通信と認証の修正の再レビュー）: 2 つ目以降のバッチが送った後の通信エラーで失敗すると、外側の hint は「index N 以降を再送して」と案内するが、失敗したバッチそのもの（index N 以降）は登録済みかもしれない。「登録された可能性あり」の hint は `cause.hint` にしか残らない。実測（`createMany` 201 件、2 つ目のバッチを通信エラーに）。

## 影響

🔴。hint どおりに index 135 以降だけを再送すると、index 0（失敗していた）は永久に登録されない。利用者はそれを知る手段が無い。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 途中で失敗したときの例外に、それまでのバッチの `results`（または失敗した index の一覧）と、結果が分からないバッチの index の範囲を載せる。
- 件数が合わない応答も同じ経路で扱う。hint の「written」は「sent」に直す。

## 処置

**実施（2026-09-26・fix/accessor-review・`a6e034f`）。** `src/accessor/write-many.ts` の `batchFailure` が、失敗したバッチの index の範囲（結果が分からない `create` のときは書かれた可能性があること）・まだ送っていない index・それまでのバッチで断られた index（20 件を超えたら残りは件数）を hint に書く。応答の件数が合わないときも同じ形で届ける。`requester.ts` に `isUnknownOutcome` を足した。

**追加の修正（2026-09-26・`c7c08f1`）。** 再レビューで、200 で読めない応答や送った後の生の Error で失敗した create のバッチを「書き込まれていない」と書いていたと分かった。PORTERS がルートの Result Code で断ったもの・4xx（408 以外）・設定の誤りだけを「書き込まれていない」とし、それ以外は「書き込まれた可能性がある」とした。

**さらに追加の修正（2026-09-26・`c41e42f`）。** 2 回目の再レビューで、ルートに Result Code があれば「書き込まれていない」としていたため、Code 1000 や表に無いコードまで「書き込まれていない」になっていたと分かった。断られたことがはっきりしている分類（validation / permission / auth / conflict / notFound / config）と Code 9、4xx（408 以外）だけを「書き込まれていない」とした。

## 検証

`src/accessor/write-many.test.ts` の途中の失敗のテスト（先に断られた index の一覧、20 件ちょうどと超えたとき、結果が分からないバッチ、最初のバッチの結果が分からないとき、`updateMany`、件数が合わない応答）。`write-many.ts` のミューテーションはすべて検出。

[adr41]: ../../adr/0041-bulk-write-surface-impl.md
