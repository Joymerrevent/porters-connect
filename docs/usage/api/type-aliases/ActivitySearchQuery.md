[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ActivitySearchQuery

# Type Alias: ActivitySearchQuery\<C\>

> **ActivitySearchQuery**\<`C`\> = [`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS` & `C`\>

Defined in: [src/resources/activity.ts:95](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/activity.ts#L95)

The Activity Read query. `C` is the declared custom-field catalog merged on, so a condition or an
order can name a custom field too.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`
