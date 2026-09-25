[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / CandidateCreateInput

# Type Alias: CandidateCreateInput\<C, CR\>

> **CandidateCreateInput**\<`C`, `CR`\> = `CreateInput`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`\>

Defined in: [src/resources/candidate.ts:97](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/candidate.ts#L97)

Fields for `create`: `P_Owner` is required; `P_Id` / system timestamps are not settable. `C`
is the declared custom-field catalog merged on; `CR` names the custom fields that are required
on `create`.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
