[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / CustomFor

# Type Alias: CustomFor\<C, K\>

> **CustomFor**\<`C`, `K`\> = `K` *extends* keyof `C` ? `C`\[`K`\] *extends* `CustomCatalog` ? `C`\[`K`\] : `EmptyCatalog` : `EmptyCatalog`

Defined in: [src/fields/define-fields.ts:116](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L116)

The custom catalog declared for resource `K` (or `{}` if none) — types each accessor (ADR-0023 D1).

## Type Parameters

### C

`C` *extends* [`DeclaredCatalogs`](DeclaredCatalogs.md)

### K

`K` *extends* [`CustomFieldResource`](CustomFieldResource.md)
