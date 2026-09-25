[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / OpportunityCreateInput

# Type Alias: OpportunityCreateInput\<C, CR\>

> **OpportunityCreateInput**\<`C`, `CR`\> = `CreateInput`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`\>

Defined in: [src/resources/opportunity.ts:96](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/opportunity.ts#L96)

Fields for `create`: owner and both references required; `P_Id` / timestamps are not settable.
`C` is the declared custom-field catalog merged on; `CR` names the custom fields that are
required on `create`.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
