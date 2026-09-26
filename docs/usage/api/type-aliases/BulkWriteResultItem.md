[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / BulkWriteResultItem

# Type Alias: BulkWriteResultItem

> **BulkWriteResultItem** = `object`

Defined in: [src/accessor/write-many.ts:26](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L26)

One record's outcome from a bulk write, in the position it was sent.

## Properties

### code

> **code**: `number`

Defined in: [src/accessor/write-many.ts:32](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L32)

PORTERS per-item Result Code (`0` = success).

***

### id

> **id**: `number`

Defined in: [src/accessor/write-many.ts:30](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L30)

Assigned (create) / echoed (update) record id. Meaningful only when `ok`.

***

### index

> **index**: `number`

Defined in: [src/accessor/write-many.ts:28](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L28)

0-based index in the input array.

***

### ok

> **ok**: `boolean`

Defined in: [src/accessor/write-many.ts:34](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/write-many.ts#L34)

`code === 0`.
