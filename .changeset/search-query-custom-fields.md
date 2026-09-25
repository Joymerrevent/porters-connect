---
"@joymerrevent/porters-connect": minor
---

**`CandidateSearchQuery` などデータ系 11 種の検索クエリの型が、宣言したカスタム項目を型引数で受け取れるようになりました**（例: `CandidateSearchQuery<CustomFor<typeof fields, "candidate">>`）。宣言した項目を `condition` や `order` に書いたクエリを、変数に取って型を付けられます。型引数を省くと、これまでと同じ型です。
