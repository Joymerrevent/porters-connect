[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / RecruiterResource

# Type Alias: RecruiterResource\<C, CR\>

> **RecruiterResource**\<`C`, `CR`\> = `Resource`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`, *typeof* `REFERENCES`\>

Defined in: [src/resources/recruiter.ts:98](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/recruiter.ts#L98)

The Recruiter accessor; `C` is the declared custom-field catalog merged on.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
