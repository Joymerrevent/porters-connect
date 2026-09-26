[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ActivityCreateInput

# Type Alias: ActivityCreateInput\<C, CR\>

> **ActivityCreateInput**\<`C`, `CR`\> = `CreateInput`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`\>

Defined in: [src/resources/activity.ts:103](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/activity.ts#L103)

Fields for `create`: `P_Owner` / `P_Title` required; `P_Id` / timestamps are not settable. `C`
is the declared custom-field catalog merged on; `CR` names the custom fields that are required
on `create`.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
