[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResourcePageOf

# Type Alias: ResourcePageOf\<T\>

> **ResourcePageOf**\<`T`\> = `object`

Defined in: [src/resources/core/read.ts:103](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L103)

A page of decoded records: the standard Read envelope (Total / Count / Start) around whatever
the item decoder produced. Parametrised by the *record* rather than the catalog because a read
that expands references returns a wider record than the catalog alone describes.

## Type Parameters

### T

`T`

## Properties

### count

> **count**: `number`

Defined in: [src/resources/core/read.ts:106](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L106)

***

### items

> **items**: `T`[]

Defined in: [src/resources/core/read.ts:104](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L104)

***

### start

> **start**: `number`

Defined in: [src/resources/core/read.ts:107](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L107)

***

### total

> **total**: `number`

Defined in: [src/resources/core/read.ts:105](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L105)
