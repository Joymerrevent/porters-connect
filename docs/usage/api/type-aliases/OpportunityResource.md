[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / OpportunityResource

# Type Alias: OpportunityResource\<C, CR\>

> **OpportunityResource**\<`C`, `CR`\> = `DataResource`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`, *typeof* `REFERENCES`\>

Defined in: [src/resources/opportunity.ts:89](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/opportunity.ts#L89)

The Opportunity accessor; `C` is the declared custom-field catalog merged on.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
