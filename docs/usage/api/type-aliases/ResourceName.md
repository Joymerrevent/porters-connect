[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResourceName

# Type Alias: ResourceName

> **ResourceName** = keyof *typeof* `RESOURCE_VALUES`

Defined in: [src/porters/resource-list.ts:35](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters/resource-list.ts#L35)

A resource PORTERS can point at by id — the vocabulary of `t.phase.of(...)`. Same spelling as
the accessor (`t.client` -> `"client"`), so a typo is a compile error rather than an HTTP 400.
