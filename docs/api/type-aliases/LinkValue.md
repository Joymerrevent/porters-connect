[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / LinkValue

# Type Alias: LinkValue

> **LinkValue** = `number` \| [`UserRef`](UserRef.md) \| [`DepartmentRef`](DepartmentRef.md)

Defined in: [src/xml/decode.ts:71](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/decode.ts#L71)

A decoded Link value (ADR-0064 論点4). PORTERS resolves a Link to **a Contact id, a User, or a
Department**, decided by the tenant's own field setting, and the response carries no
discriminator — the shapes just differ. So the value is a union and the decode reads the shape,
which cannot disagree with what arrived. Narrow with `typeof v === "number"` / `"P_Mail" in v`.
