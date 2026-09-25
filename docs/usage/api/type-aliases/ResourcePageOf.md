[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResourcePageOf

# Type Alias: ResourcePageOf\<T\>

> **ResourcePageOf**\<`T`\> = `object`

Defined in: [src/resources/core/read.ts:111](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L111)

A page of decoded records: the standard Read envelope (Total / Count / Start) around whatever
the item decoder produced. Parametrised by the *record* rather than the catalog because a read
that expands references returns a wider record than the catalog alone describes.

## Type Parameters

### T

`T`

## Properties

### count

> **count**: `number`

Defined in: [src/resources/core/read.ts:114](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L114)

***

### items

> **items**: `T`[]

Defined in: [src/resources/core/read.ts:112](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L112)

***

### start

> **start**: `number`

Defined in: [src/resources/core/read.ts:115](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L115)

***

### total

> **total**: `number`

Defined in: [src/resources/core/read.ts:113](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L113)
