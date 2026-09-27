[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldCatalogSource

# Type Alias: FieldCatalogSource

> **FieldCatalogSource** = `object`

Defined in: [src/fields/read-custom-catalog.ts:33](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L33)

The slice of a `tenant(id)` scope this tooling needs. Structural on purpose: pass
`porters.tenant(1)` and it fits, but a test can hand over just a `field` stub.

## Properties

### field

> `readonly` **field**: `object`

Defined in: [src/fields/read-custom-catalog.ts:34](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L34)

#### of()

> **of**(`resource`): `object`

##### Parameters

###### resource

[`CustomFieldResource`](CustomFieldResource.md)

##### Returns

`object`

###### searchAll()

> **searchAll**(`query?`): `AsyncIterable`\<`ReadRecord`\<\{ `P_Alias`: `"SinglelineText"`; `P_DecimalFraction`: `"Number"`; `P_Id`: `"System[Id]"`; `P_Max`: `"Number"`; `P_Min`: `"Number"`; `P_Name`: `"SinglelineText"`; `P_ReferTo`: `"Option"`; `P_Required`: `"Number"`; `P_ResourceType`: `"Number"`; `P_Type`: `"Number"`; \}\>\>

###### Parameters

###### query?

[`FieldSearchQuery`](FieldSearchQuery.md)

###### Returns

`AsyncIterable`\<`ReadRecord`\<\{ `P_Alias`: `"SinglelineText"`; `P_DecimalFraction`: `"Number"`; `P_Id`: `"System[Id]"`; `P_Max`: `"Number"`; `P_Min`: `"Number"`; `P_Name`: `"SinglelineText"`; `P_ReferTo`: `"Option"`; `P_Required`: `"Number"`; `P_ResourceType`: `"Number"`; `P_Type`: `"Number"`; \}\>\>
