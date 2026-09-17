---
"@joymerrevent/porters-connect": minor
---

**Field マスタの Read が `of()` でリソースを束ねる形になりました**（ADR-0080）。

```ts
// これまで
await t.field.search({ resource: "candidate", active: 1 });
for await (const f of t.field.searchAll({ resource: "candidate" })) { … }

// これから
await t.field.of("candidate").search({ active: 1 });
for await (const f of t.field.of("candidate").searchAll()) { … }
```

PORTERS は Field Read に **`resource=` を必須**で要求します。同じ形の Phase は以前から
`t.phase.of("client")` で束ねていたので、**URL パラメータのリソースは `of()` で束ねる**という
1 つの規則に揃えました。束ねた値は権威で、呼び出し側は上書きできません。

束ねると使い回せます。

```ts
const fields = t.field.of("candidate");
const page = await fields.search({ active: 1 });
for await (const f of fields.searchAll()) { … }
```

`readCustomCatalog` / `verifyFields` / `generateFieldDecls` の**引数は変わりません**（リソース名を
受けるのは同じです）。`porters.partition` / `t.user` / `t.option` も変わりません — この 3 つは
`resource=` を取らないためです。
