---
"@joymerrevent/porters-connect": patch
---

XML の解析に失敗したとき、例外が必ず `PortersError` になるようにしました（RV-54）。

`fast-xml-parser` は `prototype` / `constructor` / `__proto__` を**タグ名として拒否**します
（プロトタイプ汚染対策）。これらは妥当な XML Name なので書き込みは通り、**読み取りだけが
例外**になっていました。しかもその例外は素の `Error` で、`PortersError` の系統に属さないため、

```ts
try {
  await t.candidate.search();
} catch (e) {
  if (e instanceof PortersError) {
    /* ここに来ない */
  }
}
```

のように書いていると、**この例外だけがアプリケーションの最上位まで素通り**していました。

- Read は `PortersResourceError`、認証は `PortersAuthError`（どちらも `category: "unknown"`）に
  包まれます。パーサ自身の説明は `cause` に残るので、原因には辿り着けます。
- **壊れた XML も同じ経路**になりました。利用者から見ればどちらも「読めない」で同じです。
- 接頭辞の付いた項目名（`Person.prototype` のような、予約語を含むふつうの項目）は
  これまでどおり読めます。

選択肢 alias が予約名と一致するテナントは考えにくいので、実際に踏んでいた利用者は
ほとんどいないはずです。踏んだときの**倒れ方**を、ライブラリが約束している形に揃えました。
