[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / DepartmentRef

# Type Alias: DepartmentRef

> **DepartmentRef** = `object`

Defined in: [src/xml/decode.ts:42](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/decode.ts#L42)

A referenced Department (`System[Department]`). Read is nested exactly like
`User`: `<OwnerDepartment><Department><Department.P_Id>…`. Only the two fields PORTERS shows in
its sample are modelled — inventing more would be guessing.

## Properties

### P\_Id

> **P\_Id**: `number` \| `null`

Defined in: [src/xml/decode.ts:43](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/decode.ts#L43)

***

### P\_Name

> **P\_Name**: `string` \| `null`

Defined in: [src/xml/decode.ts:44](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/decode.ts#L44)
