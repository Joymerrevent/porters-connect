[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / OptionResource

# Type Alias: OptionResource

> **OptionResource** = `object`

Defined in: [src/resources/option.ts:59](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/option.ts#L59)

## Methods

### search()

> **search**(`query?`): `Promise`\<`ReadRecord`\<\{ `P_Alias`: `"SinglelineText"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; `P_Order`: `"Number"`; `P_ParentId`: `"Number"`; `P_Type`: `"Number"`; \}\>[]\>

Defined in: [src/resources/option.ts:61](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/option.ts#L61)

Read options, flattened depth-first (all nodes; tree is reconstructable via `P_ParentId`).

#### Parameters

##### query?

[`OptionSearchQuery`](OptionSearchQuery.md) & [`Limit`](Limit.md)

#### Returns

`Promise`\<`ReadRecord`\<\{ `P_Alias`: `"SinglelineText"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; `P_Order`: `"Number"`; `P_ParentId`: `"Number"`; `P_Type`: `"Number"`; \}\>[]\>
