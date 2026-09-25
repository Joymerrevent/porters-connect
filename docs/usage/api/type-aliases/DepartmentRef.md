[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / DepartmentRef

# Type Alias: DepartmentRef

> **DepartmentRef** = `object`

Defined in: [src/xml/decode.ts:15](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/decode.ts#L15)

A referenced Department (`System[Department]`). Read is nested exactly like
`User`: `<OwnerDepartment><Department><Department.P_Id>…`. Only the two fields PORTERS shows in
its sample are modelled — inventing more would be guessing.

## Properties

### P\_Id

> **P\_Id**: `number` \| `null`

Defined in: [src/xml/decode.ts:16](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/decode.ts#L16)

***

### P\_Name

> **P\_Name**: `string` \| `null`

Defined in: [src/xml/decode.ts:17](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/decode.ts#L17)
