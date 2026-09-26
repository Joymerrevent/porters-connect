[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / SalesSearchQuery

# Type Alias: SalesSearchQuery\<C\>

> **SalesSearchQuery**\<`C`\> = [`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS` & `C`, *typeof* `REFERENCES`\>

Defined in: [src/resources/sales.ts:129](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/sales.ts#L129)

The Sales Read query. `C` is the declared custom-field catalog merged on, so a condition or an
order can name a custom field too.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`
