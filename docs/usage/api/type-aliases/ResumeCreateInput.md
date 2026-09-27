[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResumeCreateInput

# Type Alias: ResumeCreateInput\<C, CR\>

> **ResumeCreateInput**\<`C`, `CR`\> = `CreateInput`\<*typeof* `FIELDS` & `C`, *typeof* `RESUME_REQUIRED_ON_CREATE`\[`number`\] \| `CR`\>

Defined in: [src/resources/resume.ts:120](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L120)

Fields for `create`: `P_Owner` required; `P_Id` / system timestamps are not settable. `C` is
the declared custom-field catalog merged on; `CR` names the custom fields that are required on
`create`.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
