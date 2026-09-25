[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ContactSearchQuery

# Type Alias: ContactSearchQuery\<C\>

> **ContactSearchQuery**\<`C`\> = [`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS` & `C`, *typeof* `REFERENCES`\>

Defined in: [src/resources/contact.ts:102](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contact.ts#L102)

The Contact Read query. `C` is the declared custom-field catalog merged on, so a condition or an
order can name a custom field too.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`
