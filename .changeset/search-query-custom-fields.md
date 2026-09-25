---
"@joymerrevent/porters-connect": minor
---

**`CandidateSearchQuery` / `CandidateCreateInput` / `CandidateUpdateInput` など、データ系 11 種の検索クエリと書き込みの入力の型が、宣言したカスタム項目を型引数で受け取れるようになりました**（例: `CandidateSearchQuery<CustomFor<typeof fields, "candidate">>`、`CandidateCreateInput<CustomFor<typeof fields, "candidate">, RequiredFor<typeof fields, "candidate">>`）。宣言した項目を書いたクエリや入力を、変数に取って型を付けられます。`create` の入力では、`required: true` を付けて宣言した項目が必須になります。型引数を省くと、これまでと同じ型です。
