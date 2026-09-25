[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResourcePageOf

# Type Alias: ResourcePageOf\<T\>

> **ResourcePageOf**\<`T`\> = `object`

Defined in: [src/resources/core/read.ts:98](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L98)

A page of decoded records: the standard Read envelope (Total / Count / Start) around whatever
the item decoder produced. Parametrised by the *record* rather than the catalog because a read
that expands references returns a wider record than the catalog alone describes.

## Type Parameters

### T

`T`

## Properties

### count

> **count**: `number`

Defined in: [src/resources/core/read.ts:101](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L101)

***

### items

> **items**: `T`[]

Defined in: [src/resources/core/read.ts:99](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L99)

***

### start

> **start**: `number`

Defined in: [src/resources/core/read.ts:102](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L102)

***

### total

> **total**: `number`

Defined in: [src/resources/core/read.ts:100](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L100)
