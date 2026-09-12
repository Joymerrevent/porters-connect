[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / Order

# Type Alias: Order\<F\>

> **Order**\<`F`\> = `Partial`\<`Record`\<`OrderableKeys`\<`F`\>, `"asc"` \| `"desc"`\>\>[]

Defined in: [src/resources/query.ts:132](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L132)

Sort spec: an ordered list of `{ field: "asc" | "desc" }`, encoded in array (then key) order. Only
orderable Data Types (Number/Date/DateTime/Age/System) are accepted (reference).

## Type Parameters

### F

`F` *extends* `FieldCatalog`
