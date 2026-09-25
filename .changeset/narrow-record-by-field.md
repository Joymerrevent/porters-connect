---
"@joymerrevent/porters-connect": minor
---

**（破壊的）読み取り（`search` / `searchAll` / `get` / `getMany`）の戻り値の型が、要求した項目だけを持つようになりました**。要求した項目とは、`field` に書いた項目と、`expand` / `image` で選んだ項目です（`get` / `getMany` では ID も）。`field` に書いていない項目に触るコードは型エラーになります。そうしたコードは実行時にいつも `undefined` を読んでいたので、`field` に足してください。型に無い項目を読む必要があるときは `rawValue` を使います。`field` を省略したとき、または中身をコンパイラが読めない配列（`string[]` の変数など）を渡したときは、これまでどおり知っている項目すべてを持つ型です。`search` / `searchAll` に `field: []` を渡したときは、項目を 1 つも持たない型になります。
