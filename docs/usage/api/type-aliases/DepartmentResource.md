[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / DepartmentResource

# Type Alias: DepartmentResource

> **DepartmentResource** = `object`

Defined in: [src/resources/department.ts:57](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L57)

## Methods

### search()

> **search**(`query?`): `Promise`\<[`DepartmentPage`](DepartmentPage.md)\>

Defined in: [src/resources/department.ts:58](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L58)

#### Parameters

##### query?

[`DepartmentSearchQuery`](DepartmentSearchQuery.md) & [`Limit`](Limit.md) & `object`

#### Returns

`Promise`\<[`DepartmentPage`](DepartmentPage.md)\>

***

### searchAll()

> **searchAll**(`query?`): `AsyncIterable`\<`ReadRecord`\<\{ `P_Hidden`: `"Number"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_SortNo`: `"Number"`; `P_UpdateDate`: `"System[DateTime]"`; \}\>\>

Defined in: [src/resources/department.ts:60](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L60)

Auto-paginating search: yields every department of the partition.

#### Parameters

##### query?

[`DepartmentSearchQuery`](DepartmentSearchQuery.md)

#### Returns

`AsyncIterable`\<`ReadRecord`\<\{ `P_Hidden`: `"Number"`; `P_Id`: `"System[Id]"`; `P_Name`: `"SinglelineText"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_SortNo`: `"Number"`; `P_UpdateDate`: `"System[DateTime]"`; \}\>\>
