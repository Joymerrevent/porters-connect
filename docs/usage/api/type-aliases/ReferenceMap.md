[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ReferenceMap

# Type Alias: ReferenceMap

> **ReferenceMap** = `Readonly`\<`Record`\<`string`, `ReferenceTarget`\>\>

Defined in: [src/accessor/expand.ts:35](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/expand.ts#L35)

A resource's expandable reference fields: bare alias -> the referenced resource's descriptor.
Only catalogued `System[Reference]` fields whose target the library implements appear here;
anything absent simply cannot be expanded (it still reads as the referenced id).
