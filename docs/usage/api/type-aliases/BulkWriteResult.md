[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / BulkWriteResult

# Type Alias: BulkWriteResult

> **BulkWriteResult** = `object`

Defined in: [src/resources/bulk-write.ts:38](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L38)

The result of `createMany` / `updateMany` (ADR-0041). `results` holds every record's outcome in
input order; `failed` is the `ok === false` subset. A per-item `code !== 0` does **not** throw —
a bulk write mixes successes and failures — so always inspect `hasFailures` / `failed`.

## Properties

### failed

> **failed**: [`BulkWriteResultItem`](BulkWriteResultItem.md)[]

Defined in: [src/resources/bulk-write.ts:40](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L40)

***

### hasFailures

> **hasFailures**: `boolean`

Defined in: [src/resources/bulk-write.ts:41](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L41)

***

### results

> **results**: [`BulkWriteResultItem`](BulkWriteResultItem.md)[]

Defined in: [src/resources/bulk-write.ts:39](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L39)
