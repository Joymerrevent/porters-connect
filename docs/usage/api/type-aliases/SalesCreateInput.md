[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / SalesCreateInput

# Type Alias: SalesCreateInput

> **SalesCreateInput** = `CreateInput`\<*typeof* `FIELDS`, *typeof* `REQUIRED_ON_CREATE`\[`number`\]\>

Defined in: [src/resources/sales.ts:121](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/sales.ts#L121)

Fields for `create`: only `P_Owner` is unconditionally required. The six references are
required *conditionally* (a dependency chain PORTERS validates server-side), so they stay
optional here — see docs/usage/topics/limits.md.
