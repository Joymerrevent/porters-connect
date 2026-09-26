[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ContractSearchQuery

# Type Alias: ContractSearchQuery\<C\>

> **ContractSearchQuery**\<`C`\> = [`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS` & `C`, *typeof* `REFERENCES`\>

Defined in: [src/resources/contract.ts:119](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contract.ts#L119)

The Contract Read query. `C` is the declared custom-field catalog merged on, so a condition or an
order can name a custom field too.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`
