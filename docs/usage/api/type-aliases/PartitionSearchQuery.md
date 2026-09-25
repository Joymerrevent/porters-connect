[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PartitionSearchQuery

# Type Alias: PartitionSearchQuery

> **PartitionSearchQuery** = `object`

Defined in: [src/resources/partition.ts:42](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L42)

Partition Read query. `requestType` 1 = partitions this App can access (default).

## Properties

### count?

> `optional` **count?**: `number`

Defined in: [src/resources/partition.ts:45](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L45)

***

### requestType?

> `optional` **requestType?**: `0` \| `1`

Defined in: [src/resources/partition.ts:44](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L44)

1 = accessible partitions (default). 0 = login partition (browser `code` grant only).

***

### start?

> `optional` **start?**: `number`

Defined in: [src/resources/partition.ts:46](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L46)
