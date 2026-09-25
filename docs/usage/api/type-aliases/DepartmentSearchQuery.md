[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / DepartmentSearchQuery

# Type Alias: DepartmentSearchQuery

> **DepartmentSearchQuery** = `object`

Defined in: [src/resources/department.ts:47](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L47)

Department Read query. The API takes no filter: every department of the partition is listed.

## Properties

### field?

> `optional` **field?**: [`ReadFieldAlias`](ReadFieldAlias.md)\<*typeof* `FIELDS`\>[]

Defined in: [src/resources/department.ts:54](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L54)

Output fields as **bare aliases** (`P_Name`); the library adds the `Department.` prefix.
**Omit** to fetch every catalogued field. Pass `[]` for PORTERS' own
default — `P_Id` alone, which is what a fieldless read returns.
