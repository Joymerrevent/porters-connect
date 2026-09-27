---
"@joymerrevent/porters-connect": patch
---

**カスタム項目と添付ファイルの細かな不具合を直しました。**

- **添付ファイルは、次の場合に送る前に `PortersConfigError` で止まります。**
  - `create` / `update` に入力そのものを渡し忘れたとき、`content: null` のとき（これまでは `TypeError`）。
  - 変える項目が 1 つも無い `update`。
  - `search` / `searchAll` の `resourceId` が正の整数でないとき。
- **添付ファイルの応答の `Id` などが空なら `null` を返します。** 数でない値は、読めない応答としてエラーにします（これまでは空を `0` と読んでいました）。
- **数の項目（`Number` / `P_Id`）の検索の条件は、10 進の表記だけを送ります。** `NaN`・`Infinity`・指数表記の数と、負の数や小数の id は、送る前に `PortersConfigError` になります。
- **カスタム項目の宣言で、名前が空の alias（`U_` だけ）や、`,` `:` `=` `.` `(` `)` 空白を含む alias を受け付けなくなりました。** これまでは、別の項目を要求する書き方になっていました。
- **`readCustomCatalog` / `generateFieldDecls` は、Field Read の行が頼んだリソースと別の接頭辞を持っていたら、エラーにします。** `verifyFields` では、そのリソースを突き合わせられなかったものとして報告します。
- **`generateFieldDecls` の `constName` に予約語（`class` など）を渡すと、`PortersConfigError` になります。**
- **`tenant(id, { fields })` は、宣言の列挙できる自分のプロパティだけを、1 回だけ読みます。**
- **Option の `count` が上限を超えたときのエラーの `hint` を、Option に合う案内（`count` を省けば全件）にしました。**
- 送信前に弾くものの一覧（上限の文書）に、添付ファイルの検査を足しました。
