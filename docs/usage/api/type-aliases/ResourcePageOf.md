[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResourcePageOf

# Type Alias: ResourcePageOf\<T\>

> **ResourcePageOf**\<`T`\> = `object`

Defined in: [src/accessor/read.ts:18](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/read.ts#L18)

A page of decoded records: the standard Read envelope (Total / Count / Start) around whatever
the item decoder produced. Parametrised by the *record* rather than the catalog because a read
that expands references returns a wider record than the catalog alone describes.

## Type Parameters

### T

`T`

## Properties

### count

> **count**: `number`

Defined in: [src/accessor/read.ts:21](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/read.ts#L21)

***

### items

> **items**: `T`[]

Defined in: [src/accessor/read.ts:19](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/read.ts#L19)

***

### start

> **start**: `number`

Defined in: [src/accessor/read.ts:22](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/read.ts#L22)

***

### total

> **total**: `number`

Defined in: [src/accessor/read.ts:20](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/read.ts#L20)
