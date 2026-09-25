[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / Condition

# Type Alias: Condition\<F\>

> **Condition**\<`F`\> = `{ [K in keyof F]?: ConditionFor<F[K]> }`

Defined in: [src/resources/core/query.ts:138](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/query.ts#L138)

A typed search condition over a catalog: each field maps to the operator object its Data Type
allows. Multiple fields are AND-joined (reference). Unknown aliases / wrong
operators are type errors. Custom `U_`/`A_` fields are not in the catalog — condition on them via
a cast (the encoder passes unknown aliases through as raw scalars, like read/write).

## Type Parameters

### F

`F` *extends* `FieldCatalog`
