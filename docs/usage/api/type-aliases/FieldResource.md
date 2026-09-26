[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldResource

# Type Alias: FieldResource

> **FieldResource** = `object`

Defined in: [src/resources/field.ts:71](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/field.ts#L71)

The Field accessor for one bound resource.

## Methods

### search()

> **search**(`query?`): `Promise`\<[`FieldPage`](FieldPage.md)\>

Defined in: [src/resources/field.ts:72](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/field.ts#L72)

#### Parameters

##### query?

[`FieldSearchQuery`](FieldSearchQuery.md) & [`Limit`](Limit.md) & `object`

#### Returns

`Promise`\<[`FieldPage`](FieldPage.md)\>

***

### searchAll()

> **searchAll**(`query?`): `AsyncIterable`\<`ReadRecord`\<\{ `P_Alias`: `"SinglelineText"`; `P_DecimalFraction`: `"Number"`; `P_Id`: `"System[Id]"`; `P_Max`: `"Number"`; `P_Min`: `"Number"`; `P_Name`: `"SinglelineText"`; `P_ReferTo`: `"Option"`; `P_Required`: `"Number"`; `P_ResourceType`: `"Number"`; `P_Type`: `"Number"`; \}\>\>

Defined in: [src/resources/field.ts:74](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/field.ts#L74)

Auto-paginating search: yields every field of the resource.

#### Parameters

##### query?

[`FieldSearchQuery`](FieldSearchQuery.md)

#### Returns

`AsyncIterable`\<`ReadRecord`\<\{ `P_Alias`: `"SinglelineText"`; `P_DecimalFraction`: `"Number"`; `P_Id`: `"System[Id]"`; `P_Max`: `"Number"`; `P_Min`: `"Number"`; `P_Name`: `"SinglelineText"`; `P_ReferTo`: `"Option"`; `P_Required`: `"Number"`; `P_ResourceType`: `"Number"`; `P_Type`: `"Number"`; \}\>\>
