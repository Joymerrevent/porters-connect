[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PartitionResource

# Type Alias: PartitionResource

> **PartitionResource** = `object`

Defined in: [src/resources/partition.ts:49](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L49)

## Methods

### search()

> **search**(`query?`): `Promise`\<[`PartitionPage`](PartitionPage.md)\>

Defined in: [src/resources/partition.ts:50](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L50)

#### Parameters

##### query?

[`PartitionSearchQuery`](PartitionSearchQuery.md)

#### Returns

`Promise`\<[`PartitionPage`](PartitionPage.md)\>

***

### searchAll()

> **searchAll**(`query?`): `AsyncIterable`\<`ReadRecord`\<\{ `P_CompanyId`: `"SinglelineText"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; \}\>\>

Defined in: [src/resources/partition.ts:52](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L52)

Auto-paginating search: yields every accessible partition.

#### Parameters

##### query?

`Omit`\<[`PartitionSearchQuery`](PartitionSearchQuery.md), `"count"` \| `"start"`\>

#### Returns

`AsyncIterable`\<`ReadRecord`\<\{ `P_CompanyId`: `"SinglelineText"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; \}\>\>
