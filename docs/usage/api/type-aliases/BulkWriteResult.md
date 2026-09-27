[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / BulkWriteResult

# Type Alias: BulkWriteResult

> **BulkWriteResult** = `object`

Defined in: [src/accessor/write-many.ts:46](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L46)

The result of `createMany` / `updateMany`. `results` holds every record's outcome in
input order; `failed` is the `ok === false` subset. A per-item `code !== 0` does **not** throw —
a bulk write mixes successes and failures — so always inspect `hasFailures` / `failed`.

## Properties

### failed

> **failed**: [`BulkWriteResultItem`](BulkWriteResultItem.md)[]

Defined in: [src/accessor/write-many.ts:48](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L48)

***

### hasFailures

> **hasFailures**: `boolean`

Defined in: [src/accessor/write-many.ts:49](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L49)

***

### results

> **results**: [`BulkWriteResultItem`](BulkWriteResultItem.md)[]

Defined in: [src/accessor/write-many.ts:47](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L47)
