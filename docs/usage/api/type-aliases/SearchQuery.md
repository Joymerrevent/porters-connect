[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / SearchQuery

# Type Alias: SearchQuery\<F, R\>

> **SearchQuery**\<`F`, `R`\> = `object`

Defined in: [src/resources/query.ts:160](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L160)

## Type Parameters

### F

`F` *extends* `FieldCatalog` = `FieldCatalog`

### R

`R` *extends* [`ReferenceMap`](ReferenceMap.md) = `EmptyReferences`

## Properties

### condition?

> `optional` **condition?**: [`Condition`](Condition.md)\<`F`\>

Defined in: [src/resources/query.ts:207](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L207)

Typed AND-conditions; each field's operators derive from its Data Type.

***

### count?

> `optional` **count?**: `number`

Defined in: [src/resources/query.ts:217](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L217)

***

### expand?

> `optional` **expand?**: [`Expand`](Expand.md)\<`R`\>

Defined in: [src/resources/query.ts:189](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L189)

Read the *fields* of a referenced record, not just its id: map an expandable
`System[Reference]` field to the bare aliases you want from the resource it points at. The
referenced prefix is supplied by the library, and the expanded fields come back decoded by
that resource's own Data Types.

```ts
const page = await t.job.search({ expand: { P_Client: ["P_Id", "P_Name"] } });
page.items[0]?.P_Client; // { P_Id: number | null; P_Name: string | null } | null
```

A field left out of `expand` still reads as the referenced id — expanding one relation costs
nothing on the others. An expanded alias replaces its plain `field` entry, so nothing is
requested twice.

***

### field?

> `optional` **field?**: [`ReadFieldAlias`](ReadFieldAlias.md)\<`F`\>[]

Defined in: [src/resources/query.ts:172](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L172)

Output fields as **bare aliases** (e.g. `P_Name`) — the same vocabulary as `condition` and
`order`; the library adds the resource's prefix. **Omit** to fetch every catalogued
field by default: PORTERS returns only the primary key for a fieldless request, so
the library sends a catalog-derived default field set instead. Pass `[]` to opt into that
API-native "primary key only" response (e.g. counting).

***

### image?

> `optional` **image?**: [`ImageOption`](ImageOption.md)\<`F`\>

Defined in: [src/resources/query.ts:205](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L205)

Read an Image field's `ContentType` / `Content`, not just its `FileName`: map an
Image-typed field to the sub-tags you want. Only what you select comes back, and the record
type narrows to exactly that.

```ts
const page = await t.resume.search({ image: { U_photo: ["FileName", "Content"] } });
page.items[0]?.U_photo; // { FileName: string | null; Content: string | null }
```

A field left out reads back `FileName` alone — PORTERS' own default — so listing records never
drags every image body along with it. Like `expand`, a selected alias replaces its plain
`field` entry, so nothing is requested twice.

***

### itemstate?

> `optional` **itemstate?**: [`ItemState`](ItemState.md)

Defined in: [src/resources/query.ts:216](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L216)

Delete-state filter (default `existing`). `deleted`/`all` restrict `condition` — see [ItemState](ItemState.md).

***

### keywords?

> `optional` **keywords?**: `string`[]

Defined in: [src/resources/query.ts:214](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L214)

Keyword AND-search over text fields (MultilineText/SinglelineText/Mail/URL; Telephone digits
only). OR is not supported. Max 100 characters including commas — guarded before send.

***

### order?

> `optional` **order?**: [`Order`](Order.md)\<`F`\>

Defined in: [src/resources/query.ts:209](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L209)

Sort order; orderable Data Types only (Number/Date/DateTime/Age/System).

***

### start?

> `optional` **start?**: `number`

Defined in: [src/resources/query.ts:218](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L218)
