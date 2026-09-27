[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PartitionSearchQuery

# Type Alias: PartitionSearchQuery

> **PartitionSearchQuery** = `object`

Defined in: [src/resources/partition.ts:39](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L39)

Partition Read query. `requestType` 1 = partitions this App can access (default).

## Properties

### requestType?

> `optional` **requestType?**: `0` \| `1`

Defined in: [src/resources/partition.ts:41](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L41)

1 = accessible partitions (default). 0 = login partition (browser `code` grant only).
