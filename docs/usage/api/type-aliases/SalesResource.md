[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / SalesResource

# Type Alias: SalesResource\<C, CR\>

> **SalesResource**\<`C`, `CR`\> = `DataResource`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`, *typeof* `REFERENCES`\>

Defined in: [src/resources/sales.ts:130](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/sales.ts#L130)

The Sales accessor; `C` is the declared custom-field catalog merged on.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
