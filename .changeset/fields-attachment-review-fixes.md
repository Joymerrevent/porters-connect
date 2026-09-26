---
"@joymerrevent/porters-connect": patch
---

**カスタム項目の宣言と、添付ファイルの書き込みの不具合を直しました。**

- **`defineFields` と `tenant()` が、存在しない Data Type の宣言を受け付けなくなりました。** JavaScript から、または型を迂回して不正な宣言を渡すと、これまでは読むと項目が結果から消え、書くと `undefined` の文字列を送っていました。どちらも `PortersConfigError` になります。`tenant()` は、`defineFields` を通さずに渡された宣言も確かめます。
- **`verifyFields` が、宣言では表せない項目の宣言を見つけるようになりました。** Reference など値を持たない型や、システムの項目を宣言していると、読むと常に `null` になりますが、これまでは `ok: true` でした。レポートの `declaredUndeclarable` に載り、`ok` が `false` になり、`assertFieldsMatch` も例外を投げます。ライブラリがまだ知らない型は、知らせるだけで `ok` は倒しません。
- **添付ファイルの `create` / `update` が、書き込む値を送る前に確かめるようになりました。** `resourceId` は正の整数、`contentType` と `fileName` は空でない文字列、`content` は Base64 として成り立つ形（4 文字単位で、`=` は末尾だけ。改行・タブ・半角スペースは含んでよい）です。これまでは、JavaScript から渡し忘れると `undefined` の文字列を送り、壊れた添付ファイルができていました（添付ファイルは削除できません）。
- **`generateFieldDecls` が、テナントの項目名や alias で生成物を壊さなくなりました。** 識別子でない alias は文字列のキーにし、項目名の改行はコメントの中で空白に置き換えます。`constName` が識別子でなければ `PortersConfigError` になります。
