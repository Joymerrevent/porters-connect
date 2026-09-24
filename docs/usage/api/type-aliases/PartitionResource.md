[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PartitionResource

# Type Alias: PartitionResource

> **PartitionResource** = `object`

Defined in: [src/resources/partition.ts:50](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L50)

## Methods

### search()

> **search**(`query?`): `Promise`\<[`PartitionPage`](PartitionPage.md)\>

Defined in: [src/resources/partition.ts:51](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L51)

#### Parameters

##### query?

[`PartitionSearchQuery`](PartitionSearchQuery.md)

#### Returns

`Promise`\<[`PartitionPage`](PartitionPage.md)\>

***

### searchAll()

> **searchAll**(`query?`): `AsyncIterable`\<`ReadRecord`\<\{ `P_CompanyId`: `"SinglelineText"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; \}\>\>

Defined in: [src/resources/partition.ts:53](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L53)

Auto-paginating search: yields every accessible partition.

#### Parameters

##### query?

`Omit`\<[`PartitionSearchQuery`](PartitionSearchQuery.md), `"count"` \| `"start"`\>

#### Returns

`AsyncIterable`\<`ReadRecord`\<\{ `P_CompanyId`: `"SinglelineText"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; \}\>\>
