[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / BulkWriteResult

# Type Alias: BulkWriteResult

> **BulkWriteResult** = `object`

Defined in: [src/accessor/write-many.ts:39](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L39)

The result of `createMany` / `updateMany`. `results` holds every record's outcome in
input order; `failed` is the `ok === false` subset. A per-item `code !== 0` does **not** throw —
a bulk write mixes successes and failures — so always inspect `hasFailures` / `failed`.

## Properties

### failed

> **failed**: [`BulkWriteResultItem`](BulkWriteResultItem.md)[]

Defined in: [src/accessor/write-many.ts:41](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L41)

***

### hasFailures

> **hasFailures**: `boolean`

Defined in: [src/accessor/write-many.ts:42](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L42)

***

### results

> **results**: [`BulkWriteResultItem`](BulkWriteResultItem.md)[]

Defined in: [src/accessor/write-many.ts:40](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L40)
