---
"@joymerrevent/porters-connect": minor
---

Read クエリ面に typed `condition` ＋ `order` / `keywords` / `itemstate` を追加（F-2 / ADR-0038）。`condition` は loose な `Record<string,string>` から、項目の Data Type ごとに演算子・値型が決まる型付き形へ変更（破壊的変更・pre-1.0 ゆえ minor）。
