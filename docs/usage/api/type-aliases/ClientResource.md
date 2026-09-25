[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ClientResource

# Type Alias: ClientResource\<C, CR\>

> **ClientResource**\<`C`, `CR`\> = `DataResource`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`\>

Defined in: [src/resources/client.ts:78](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/client.ts#L78)

The Client accessor; `C` is the declared custom-field catalog merged on.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
