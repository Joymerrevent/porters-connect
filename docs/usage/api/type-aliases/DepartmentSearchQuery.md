[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / DepartmentSearchQuery

# Type Alias: DepartmentSearchQuery

> **DepartmentSearchQuery** = `object`

Defined in: [src/resources/department.ts:53](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L53)

Department Read query. The API takes no filter: every department of the partition is listed.

## Properties

### count?

> `optional` **count?**: `number`

Defined in: [src/resources/department.ts:60](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L60)

***

### field?

> `optional` **field?**: [`ReadFieldAlias`](ReadFieldAlias.md)\<*typeof* `FIELDS`\>[]

Defined in: [src/resources/department.ts:59](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L59)

Output fields as **bare aliases** (`P_Name`); the library adds the `Department.` prefix
(ADR-0059). **Omit** to fetch every catalogued field (ADR-0020). Pass `[]` for PORTERS' own
default — `P_Id` alone, which is what a fieldless read returns.

***

### start?

> `optional` **start?**: `number`

Defined in: [src/resources/department.ts:61](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L61)
