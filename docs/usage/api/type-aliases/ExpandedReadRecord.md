[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ExpandedReadRecord

# Type Alias: ExpandedReadRecord\<F, R, E\>

> **ExpandedReadRecord**\<`F`, `R`, `E`\> = `Omit`\<`ReadRecord`\<`F`\>, keyof `E`\> & \{ \[K in keyof E & keyof R\]?: ExpandedValue\<R\[K\], E\[K\]\> \| null \}

Defined in: [src/resources/expand.ts:81](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/expand.ts#L81)

The read record for a query that expanded some references: the plain ReadRecord, with
each expanded field's value replaced by the referenced record's own shape. Fields left out of
`expand` keep the referenced id (`number`), so a caller who expands one relation pays no type
cost on the others — that asymmetry is the point of `expand` over widening the base type.

## Type Parameters

### F

`F` *extends* `FieldCatalog`

### R

`R` *extends* [`ReferenceMap`](ReferenceMap.md)

### E

`E`
