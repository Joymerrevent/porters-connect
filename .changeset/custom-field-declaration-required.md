---
"@joymerrevent/porters-connect": minor
---

カスタム項目を「宣言してから使う」に揃え、逃げ道に `rawValue` を用意した（ADR-0074）。

**`field` が未宣言のカスタム項目を受け付けなくなる。** これまで `field` だけが
`U_`/`A_` で始まる名前を宣言なしで受けていた。`condition` / `order` / 書き込みは以前から
宣言必須なので、入口 4 つのうち 1 つだけが例外という状態だった。しかも `field` に書けても
受け取り側の型には出ないため、**要求はできるのに読めない**という非対称が残っていた。

```ts
// これまで通っていた
await t.candidate.search({ field: ["U_memo"] });
//                                 ^^^^^^^^ 型エラーになる
```

**直し方は宣言**（`defineFields`）。項目を 1 つ足すだけなら 1 行で、`generateFieldDecls` で
テナントの項目から生成もできる。宣言すれば `U_` 以降の綴りも検査され、値も Data Type どおりに
変換される。

**実行時は変えていない。** 型を外せば送れるし、応答に知らない項目が混ざっても落ちない。
宣言せずに触る必要があるときは、`field` を cast して `rawValue` で受ける。

```ts
import { rawValue } from "@joymerrevent/porters-connect";
import type { CandidateSearchQuery } from "@joymerrevent/porters-connect";

const page = await t.candidate.search({
  field: ["P_Name", "U_memo"] as CandidateSearchQuery["field"],
});
const memo = rawValue(page.items[0], "U_memo"); // string | null | undefined
```

`rawValue` はレコードが持っているものをそのまま返す。応答に無ければ `undefined`、スカラで
なければ（`Option` / `User` / `Image` の入れ子）`null`、あれば生の文字列。**変換はしない**ので、
日時は PORTERS の書式（`2026/09/10 12:00:00`）のままになる。

副次的に、**宣言が違うクライアントを関数に渡せなくなった**。`TenantScope<typeof fields>` は
その宣言のスコープだけを受け取る。以前は型が通ってしまい、`number` と型が言う値に生の文字列が
入ることがあった。`TenantScope<DeclaredCatalogs>`（どの宣言でも受ける書き方）はこれまでどおり。

新しい公開記号: `rawValue`。
