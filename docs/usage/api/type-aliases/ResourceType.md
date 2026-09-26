[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResourceType

# Type Alias: ResourceType

> **ResourceType** = [`ResourceName`](ResourceName.md)

Defined in: [src/resources/field.ts:28](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/field.ts#L28)

A resource whose field catalog can be read (Field Read `resource` selector).

Field Read takes a Resource List Value, so the selectable set **is** the set PORTERS gives a
Value — the same one `t.phase.of()` accepts. This is an alias rather than a second table on
purpose: a separate copy once silently lost a resource, so the Value table lives in one place
and both roles read from it.
