[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / OpportunitySearchQuery

# Type Alias: OpportunitySearchQuery\<C\>

> **OpportunitySearchQuery**\<`C`\> = [`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS` & `C`, *typeof* `REFERENCES`\>

Defined in: [src/resources/opportunity.ts:87](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/opportunity.ts#L87)

The Opportunity Read query. `C` is the declared custom-field catalog merged on, so a condition or an
order can name a custom field too.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`
