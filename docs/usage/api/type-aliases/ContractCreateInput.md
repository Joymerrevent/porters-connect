[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ContractCreateInput

# Type Alias: ContractCreateInput\<C, CR\>

> **ContractCreateInput**\<`C`, `CR`\> = `CreateInput`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`\>

Defined in: [src/resources/contract.ts:124](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contract.ts#L124)

Fields for `create`: only `P_Client` required (Contract has no owner field). `C` is the
declared custom-field catalog merged on; `CR` names the custom fields that are required on
`create`.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
