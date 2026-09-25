[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ContactResource

# Type Alias: ContactResource\<C, CR\>

> **ContactResource**\<`C`, `CR`\> = `Resource`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`, *typeof* `REFERENCES`\>

Defined in: [src/resources/contact.ts:99](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contact.ts#L99)

The Contact accessor; `C` is the declared custom-field catalog merged on.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
