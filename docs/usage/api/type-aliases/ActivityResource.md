[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ActivityResource

# Type Alias: ActivityResource\<C, CR\>

> **ActivityResource**\<`C`, `CR`\> = `Resource`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`\>

Defined in: [src/resources/activity.ts:91](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/activity.ts#L91)

The Activity accessor; `C` is the declared custom-field catalog merged on.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
