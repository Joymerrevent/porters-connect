[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResumeResource

# Type Alias: ResumeResource\<C, CR\>

> **ResumeResource**\<`C`, `CR`\> = `Resource`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`, *typeof* `REFERENCES`\>

Defined in: [src/resources/resume.ts:104](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L104)

The Resume accessor; `C` is the declared custom-field catalog merged on.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
