[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ProcessResource

# Type Alias: ProcessResource\<C, CR\>

> **ProcessResource**\<`C`, `CR`\> = `DataResource`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`, *typeof* `REFERENCES`\>

Defined in: [src/resources/process.ts:109](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/process.ts#L109)

The Process accessor; `C` is the declared custom-field catalog merged on.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
