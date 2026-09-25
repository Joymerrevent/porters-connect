[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ProcessCreateInput

# Type Alias: ProcessCreateInput\<C, CR\>

> **ProcessCreateInput**\<`C`, `CR`\> = `CreateInput`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`\>

Defined in: [src/resources/process.ts:119](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/process.ts#L119)

Fields for `create`: `P_Owner` required; `P_Id` / system timestamps are not settable. `C` is
the declared custom-field catalog merged on; `CR` names the custom fields that are required on
`create`.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
