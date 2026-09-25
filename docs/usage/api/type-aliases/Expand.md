[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / Expand

# Type Alias: Expand\<R\>

> **Expand**\<`R`\> = `{ [K in keyof R]?: readonly (keyof CatalogOf<R[K]> & string)[] }`

Defined in: [src/resources/core/expand.ts:60](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/expand.ts#L60)

What `expand` accepts: for each expandable reference field, the **bare aliases** to read from
the referenced record. The referenced prefix is never written by the caller — the descriptor
has it. Only catalogued aliases of the target are allowed: an alias outside its
catalog has no Data Type here, so nothing could type or decode it.

## Type Parameters

### R

`R` *extends* [`ReferenceMap`](ReferenceMap.md)
