---
"@joymerrevent/porters-connect": minor
---

Phase の Read クエリから `keywords` / `itemstate` を外した（ADR-0076）。

**`t.phase.of(...)` の `search` / `searchAll` がこの 2 つを受け付けなくなる。** PORTERS の
`Phase - Read` は Input Variables にこの 2 つを挙げていない。取得済みの Read 記事 17 本を数えると、
**共通語彙のデータ系 11 本は URL テンプレートと表の両方に載せ、Phase / Attachment / マスタ 4 種は
1 本も載せていない**（11/11 対 0/6）ので、記事側の省略ではなく**エンドポイントごとに取るものが
違う**と読める。

出典に無いパラメータを送ると、無視されるのではなく **Read 全体が失敗する**可能性がある
（Result Code 100 / 102）。安全側は「送らない」なので、型の側で閉じた。

```ts
// これまで通っていた
await t.phase.of("client").search({ keywords: ["山田"] });
//                                  ^^^^^^^^ 型エラーになる
```

**実行時は変えていない。** cast すれば今までどおり送られる。契約環境で「実は受け付ける」と
分かったときに確かめる手段を残すためで、受け付けると分かれば型に戻す（追加なので非破壊）。

汎用 factory 側には「このエンドポイントは取らないクエリキー」を表す型引数が増えた。
共通語彙の 11 リソースは今までどおり `keywords` / `itemstate` を取る。
