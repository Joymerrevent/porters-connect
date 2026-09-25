[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ClientCreateInput

# Type Alias: ClientCreateInput\<C, CR\>

> **ClientCreateInput**\<`C`, `CR`\> = `CreateInput`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`\>

Defined in: [src/resources/client.ts:91](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/client.ts#L91)

Fields for `create`: `P_Owner` required; `P_Id` / system timestamps are not settable. `C` is
the declared custom-field catalog merged on; `CR` names the custom fields that are required on
`create`.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
