[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldResource

# Type Alias: FieldResource

> **FieldResource** = `object`

Defined in: [src/resources/field.ts:76](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/field.ts#L76)

The Field accessor for one bound resource.

## Methods

### search()

> **search**(`query?`): `Promise`\<[`FieldPage`](FieldPage.md)\>

Defined in: [src/resources/field.ts:77](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/field.ts#L77)

#### Parameters

##### query?

[`FieldSearchQuery`](FieldSearchQuery.md)

#### Returns

`Promise`\<[`FieldPage`](FieldPage.md)\>

***

### searchAll()

> **searchAll**(`query?`): `AsyncIterable`\<`ReadRecord`\<\{ `P_Alias`: `"SinglelineText"`; `P_DecimalFraction`: `"Number"`; `P_Id`: `"System[Id]"`; `P_Max`: `"Number"`; `P_Min`: `"Number"`; `P_Name`: `"SinglelineText"`; `P_ReferTo`: `"Option"`; `P_Required`: `"Number"`; `P_ResourceType`: `"Number"`; `P_Type`: `"Number"`; \}\>\>

Defined in: [src/resources/field.ts:79](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/field.ts#L79)

Auto-paginating search: yields every field of the resource.

#### Parameters

##### query?

`Omit`\<[`FieldSearchQuery`](FieldSearchQuery.md), `"count"` \| `"start"`\>

#### Returns

`AsyncIterable`\<`ReadRecord`\<\{ `P_Alias`: `"SinglelineText"`; `P_DecimalFraction`: `"Number"`; `P_Id`: `"System[Id]"`; `P_Max`: `"Number"`; `P_Min`: `"Number"`; `P_Name`: `"SinglelineText"`; `P_ReferTo`: `"Option"`; `P_Required`: `"Number"`; `P_ResourceType`: `"Number"`; `P_Type`: `"Number"`; \}\>\>
