---
"@joymerrevent/porters-connect": patch
---

**数値でない文字列を `Number` として読まなくなりました**（RV-58）。`Number` / `System[Id]` の項目と
`Link` のスカラ形（Contact の ID）に数値として読めない値が来ると、`PortersResourceError`
（`category: "validation"`・項目名つき）で失敗します。以前は `Number("社内候補")` の結果＝**`NaN`** が
黙って読み取り値に入り、`typeof === "number"` と `null` 判定の両方を通り、そのまま `update` に戻すと
`<Alias>NaN</Alias>` を送っていました。

```text
U_score: declared Number, but "社内候補" is not a PORTERS Number value
```

- 起きるのは**宣言が違うとき**です（テキストの項目を `f.number()` と宣言した、など）。PORTERS が
  Number 項目に数値以外を返す書式は出典にありません。日時（`f.date()` 等）が 0.15.0 から同じ形で
  落ちるのと揃えました。
- 数値として読める値（`"87"` / `"-1.25"` / 前後の空白）と空（`null`）は変わりません。
- 書き込み側は変えていません（`NaN` を渡す JS コードは以前どおりそのまま送られます）。
- 事前に宣言を突き合わせるなら、これまでどおり `verifyFields` です。
