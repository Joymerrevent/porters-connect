[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ClientSearchQuery

# Type Alias: ClientSearchQuery\<C\>

> **ClientSearchQuery**\<`C`\> = [`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS` & `C`\>

Defined in: [src/resources/client.ts:84](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/client.ts#L84)

The Client Read query. `C` is the declared custom-field catalog merged on, so a condition or an
order can name a custom field too.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`
