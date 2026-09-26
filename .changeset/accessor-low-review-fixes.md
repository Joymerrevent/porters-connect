---
"@joymerrevent/porters-connect": patch
---

**読み取りと書き込みの細かな不具合を直しました。**

- **`field` に同じ項目を 2 回書いても、1 回だけ送ります。** これまでは、`expand` / `image` で選んだ項目の素の値も一緒に送っていました。
- **`keywords` に空のキーワードがあると、送る前に `PortersConfigError` になります。**
- **画像の値の `FileName` / `ContentType` / `Content` のどれかが文字列でないと、送る前に `PortersConfigError` になります。** 改行を含む Base64 は、改行を除いた大きさで 2MB の上限と比べます。
- **`get` などの id に BigInt を渡しても、`TypeError` ではなく `PortersConfigError` になります。**
- **`createMany` / `updateMany` が、トークンの取得に失敗して何も送らなかったときは、元のエラーをそのまま返します。** これまでは「書き込まれた可能性がある」エラーにしていました。
- **`updateMany` が途中で止まったときのエラーの `hint` が、失敗したバッチもそのまま送り直してよいことを案内します。**
- 次の 3 つを文書に書きました。
  - `createMany` の件ごとの `code` が `302` のときは、作られたかを確かめてから再送すること。
  - `field: []` のときは `expand` / `image` も送られないこと。
  - `searchAll` は、辿っている途中でレコードが減ると取りこぼすこと。
