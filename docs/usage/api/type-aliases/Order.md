[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / Order

# Type Alias: Order\<F\>

> **Order**\<`F`\> = `Partial`\<`Record`\<`OrderableKeys`\<`F`\>, `"asc"` \| `"desc"`\>\>[]

Defined in: [src/resources/core/query.ts:138](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/query.ts#L138)

Sort spec: an ordered list of `{ field: "asc" | "desc" }`, encoded in array (then key) order. Only
orderable Data Types (Number/Date/DateTime/Age/System) are accepted (reference).

## Type Parameters

### F

`F` *extends* `FieldCatalog`
