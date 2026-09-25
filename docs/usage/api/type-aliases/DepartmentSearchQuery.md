[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / DepartmentSearchQuery

# Type Alias: DepartmentSearchQuery

> **DepartmentSearchQuery** = `object`

Defined in: [src/resources/department.ts:50](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L50)

Department Read query. The API takes no filter: every department of the partition is listed.

## Properties

### count?

> `optional` **count?**: `number`

Defined in: [src/resources/department.ts:58](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L58)

***

### field?

> `optional` **field?**: [`ReadFieldAlias`](ReadFieldAlias.md)\<*typeof* `FIELDS`\>[]

Defined in: [src/resources/department.ts:57](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L57)

Output fields as **bare aliases** (`P_Name`); the library adds the `Department.` prefix.
**Omit** to fetch every catalogued field. Pass `[]` for PORTERS' own
default — `P_Id` alone, which is what a fieldless read returns.

***

### start?

> `optional` **start?**: `number`

Defined in: [src/resources/department.ts:59](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/department.ts#L59)
