---
"@joymerrevent/porters-connect": minor
---

**（破壊的）検索クエリの型（`SearchQuery` と `CandidateSearchQuery` などの各 `…SearchQuery`）から `count` / `start` を外し、ページ送りを別の型 `Paging`（`count` / `start`）にしました**。`search` はクエリと `Paging` を一緒に受け取り、`searchAll` はクエリだけを受け取ります。同じクエリを `search` と `searchAll` の両方に渡せます。Option の `search` は件数の上限だけを受け取るので、`count` だけを持つ `Limit` を受けます。`t.candidate.search({ field: ["P_Name"], count: 50 })` のように、その場でオブジェクトを書いているコードはそのまま動きます。クエリを変数に取って `…SearchQuery` の型を付け、`count` / `start` を書いているコードは、型を `CandidateSearchQuery & Paging`（Option は `OptionSearchQuery & Limit`）に書き換えてください。`AttachmentWalkQuery` は無くしたので、`AttachmentSearchQuery` に書き換えてください。
