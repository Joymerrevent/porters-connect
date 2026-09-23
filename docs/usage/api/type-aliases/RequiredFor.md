[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / RequiredFor

# Type Alias: RequiredFor\<C, K\>

> **RequiredFor**\<`C`, `K`\> = `C` *extends* `object` ? `K` *extends* keyof `Rq` ? `Extract`\<`Rq`\[`K`\], keyof [`CustomFor`](CustomFor.md)\<`C`, `K`\>\> : `never` : `never`

Defined in: [src/fields/define-fields.ts:200](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L200)

The aliases of resource `K` that `create` requires because the declaration said
`required: true` (or `never`). Read off the phantom that [defineFields](../functions/defineFields.md) puts on its
result type, so a scope typed `TenantScope<typeof fields>` picks it up with no extra type argument.

## Type Parameters

### C

`C` *extends* [`DeclaredCatalogs`](DeclaredCatalogs.md)

### K

`K` *extends* [`CustomFieldResource`](CustomFieldResource.md)
