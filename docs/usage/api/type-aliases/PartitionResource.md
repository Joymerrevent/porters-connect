[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PartitionResource

# Type Alias: PartitionResource

> **PartitionResource** = `object`

Defined in: [src/resources/partition.ts:47](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L47)

## Methods

### search()

> **search**(`query?`): `Promise`\<[`PartitionPage`](PartitionPage.md)\>

Defined in: [src/resources/partition.ts:48](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L48)

#### Parameters

##### query?

[`PartitionSearchQuery`](PartitionSearchQuery.md) & [`Limit`](Limit.md) & `object`

#### Returns

`Promise`\<[`PartitionPage`](PartitionPage.md)\>

***

### searchAll()

> **searchAll**(`query?`): `AsyncIterable`\<`ReadRecord`\<\{ `P_CompanyId`: `"SinglelineText"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; \}\>\>

Defined in: [src/resources/partition.ts:50](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/partition.ts#L50)

Auto-paginating search: yields every accessible partition.

#### Parameters

##### query?

[`PartitionSearchQuery`](PartitionSearchQuery.md)

#### Returns

`AsyncIterable`\<`ReadRecord`\<\{ `P_CompanyId`: `"SinglelineText"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; \}\>\>
