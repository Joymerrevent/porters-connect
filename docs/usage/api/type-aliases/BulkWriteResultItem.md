[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / BulkWriteResultItem

# Type Alias: BulkWriteResultItem

> **BulkWriteResultItem** = `object`

Defined in: [src/resources/bulk-write.ts:22](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L22)

One record's outcome from a bulk write, in the position it was sent (ADR-0041 SD-2).

## Properties

### code

> **code**: `number`

Defined in: [src/resources/bulk-write.ts:28](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L28)

PORTERS per-item Result Code (`0` = success).

***

### id

> **id**: `number`

Defined in: [src/resources/bulk-write.ts:26](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L26)

Assigned (create) / echoed (update) record id. Meaningful only when `ok`.

***

### index

> **index**: `number`

Defined in: [src/resources/bulk-write.ts:24](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L24)

0-based index in the input array.

***

### ok

> **ok**: `boolean`

Defined in: [src/resources/bulk-write.ts:30](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L30)

`code === 0`.
