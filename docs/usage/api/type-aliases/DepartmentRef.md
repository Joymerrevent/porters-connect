[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / DepartmentRef

# Type Alias: DepartmentRef

> **DepartmentRef** = `object`

Defined in: [src/xml/field-value.ts:12](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/field-value.ts#L12)

A referenced Department (`System[Department]`). Read is nested exactly like
`User`: `<OwnerDepartment><Department><Department.P_Id>…`. Only the two fields PORTERS shows in
its sample are modelled — inventing more would be guessing.

## Properties

### P\_Id

> **P\_Id**: `number` \| `null`

Defined in: [src/xml/field-value.ts:13](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/field-value.ts#L13)

***

### P\_Name

> **P\_Name**: `string` \| `null`

Defined in: [src/xml/field-value.ts:14](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/field-value.ts#L14)
