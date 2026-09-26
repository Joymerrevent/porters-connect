[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / RecruiterCreateInput

# Type Alias: RecruiterCreateInput\<C, CR\>

> **RecruiterCreateInput**\<`C`, `CR`\> = `CreateInput`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`\>

Defined in: [src/resources/recruiter.ts:110](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/recruiter.ts#L110)

Fields for `create`: `P_Owner` / `P_Client` required; `P_Id` / system timestamps are not
settable. `C` is the declared custom-field catalog merged on; `CR` names the custom fields
that are required on `create`.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
