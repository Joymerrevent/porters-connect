[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResourcePageOf

# Type Alias: ResourcePageOf\<T\>

> **ResourcePageOf**\<`T`\> = `object`

Defined in: [src/accessor/resource-page.ts:11](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/resource-page.ts#L11)

A page of decoded records: the standard Read envelope (Total / Count / Start) around whatever
the item decoder produced. Parametrised by the *record* rather than the catalog because a read
that expands references returns a wider record than the catalog alone describes.

## Type Parameters

### T

`T`

## Properties

### count

> **count**: `number`

Defined in: [src/accessor/resource-page.ts:14](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/resource-page.ts#L14)

***

### items

> **items**: `T`[]

Defined in: [src/accessor/resource-page.ts:12](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/resource-page.ts#L12)

***

### start

> **start**: `number`

Defined in: [src/accessor/resource-page.ts:15](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/resource-page.ts#L15)

***

### total

> **total**: `number`

Defined in: [src/accessor/resource-page.ts:13](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/resource-page.ts#L13)
