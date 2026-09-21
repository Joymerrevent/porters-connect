[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / BulkWriteResultItem

# Type Alias: BulkWriteResultItem

> **BulkWriteResultItem** = `object`

Defined in: [src/resources/bulk-write.ts:23](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L23)

One record's outcome from a bulk write, in the position it was sent.

## Properties

### code

> **code**: `number`

Defined in: [src/resources/bulk-write.ts:29](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L29)

PORTERS per-item Result Code (`0` = success).

***

### id

> **id**: `number`

Defined in: [src/resources/bulk-write.ts:27](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L27)

Assigned (create) / echoed (update) record id. Meaningful only when `ok`.

***

### index

> **index**: `number`

Defined in: [src/resources/bulk-write.ts:25](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L25)

0-based index in the input array.

***

### ok

> **ok**: `boolean`

Defined in: [src/resources/bulk-write.ts:31](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/bulk-write.ts#L31)

`code === 0`.
