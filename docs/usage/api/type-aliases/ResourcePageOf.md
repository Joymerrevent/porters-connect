[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResourcePageOf

# Type Alias: ResourcePageOf\<T\>

> **ResourcePageOf**\<`T`\> = `object`

Defined in: [src/resources/read-core.ts:96](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/read-core.ts#L96)

A page of decoded records: the standard Read envelope (Total / Count / Start) around whatever
the item decoder produced. Parametrised by the *record* rather than the catalog because a read
that expands references returns a wider record than the catalog alone describes (ADR-0058).

## Type Parameters

### T

`T`

## Properties

### count

> **count**: `number`

Defined in: [src/resources/read-core.ts:99](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/read-core.ts#L99)

***

### items

> **items**: `T`[]

Defined in: [src/resources/read-core.ts:97](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/read-core.ts#L97)

***

### start

> **start**: `number`

Defined in: [src/resources/read-core.ts:100](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/read-core.ts#L100)

***

### total

> **total**: `number`

Defined in: [src/resources/read-core.ts:98](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/read-core.ts#L98)
