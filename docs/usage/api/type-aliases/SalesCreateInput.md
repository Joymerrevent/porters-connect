[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / SalesCreateInput

# Type Alias: SalesCreateInput\<C, CR\>

> **SalesCreateInput**\<`C`, `CR`\> = `CreateInput`\<*typeof* `FIELDS` & `C`, *typeof* `REQUIRED_ON_CREATE`\[`number`\] \| `CR`\>

Defined in: [src/resources/sales.ts:137](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/sales.ts#L137)

Fields for `create`: only `P_Owner` is unconditionally required. The six references are
required *conditionally* (a dependency chain PORTERS validates server-side), so they stay
optional here — see docs/usage/topics/limits.md. `C` is the declared custom-field catalog
merged on; `CR` names the custom fields that are required on `create`.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`
