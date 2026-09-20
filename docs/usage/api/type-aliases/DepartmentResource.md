[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / DepartmentResource

# Type Alias: DepartmentResource

> **DepartmentResource** = `object`

Defined in: src/resources/department.ts:64

## Methods

### search()

> **search**(`query?`): `Promise`\<[`DepartmentPage`](DepartmentPage.md)\>

Defined in: src/resources/department.ts:65

#### Parameters

##### query?

[`DepartmentSearchQuery`](DepartmentSearchQuery.md)

#### Returns

`Promise`\<[`DepartmentPage`](DepartmentPage.md)\>

***

### searchAll()

> **searchAll**(`query?`): `AsyncIterable`\<`ReadRecord`\<\{ `P_Hidden`: `"Number"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_SortNo`: `"Number"`; `P_UpdateDate`: `"System[DateTime]"`; \}\>\>

Defined in: src/resources/department.ts:67

Auto-paginating search: yields every department of the partition.

#### Parameters

##### query?

`Omit`\<[`DepartmentSearchQuery`](DepartmentSearchQuery.md), `"count"` \| `"start"`\>

#### Returns

`AsyncIterable`\<`ReadRecord`\<\{ `P_Hidden`: `"Number"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_SortNo`: `"Number"`; `P_UpdateDate`: `"System[DateTime]"`; \}\>\>
