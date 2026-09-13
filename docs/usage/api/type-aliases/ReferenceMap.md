[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ReferenceMap

# Type Alias: ReferenceMap

> **ReferenceMap** = `Readonly`\<`Record`\<`string`, `ReferenceTarget`\>\>

Defined in: [src/resources/expand.ts:36](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/expand.ts#L36)

A resource's expandable reference fields: bare alias -> the referenced resource's descriptor.
Only catalogued `System[Reference]` fields whose target the library implements appear here;
anything absent simply cannot be expanded (it still reads as the referenced id).
