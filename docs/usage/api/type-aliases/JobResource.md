[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / JobResource

# Type Alias: JobResource\<C, CR\>

> **JobResource**\<`C`, `CR`\> = `DataResource`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`, *typeof* `REFERENCES`\>

Defined in: [src/resources/job.ts:111](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/job.ts#L111)

The Job accessor; `C` is the declared custom-field catalog merged on.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
