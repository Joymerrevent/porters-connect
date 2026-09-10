[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ImageSelectedValue

# Type Alias: ImageSelectedValue\<S\>

> **ImageSelectedValue**\<`S`\> = \[`S`\] *extends* \[readonly infer A[]\] ? \{ \[K in A\]: string \| null \} : [`ImageValue`](ImageValue.md)

Defined in: [src/resources/image.ts:57](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/image.ts#L57)

The value a selected Image field reads back as: exactly the sub-tags that were selected, each
`string | null`.

`[S] extends [...]` is **non-distributive** for the same reason an expanded value's is — a
caller who types their query as the loose `SearchQuery` passes `readonly ImageSubField[] |
undefined`, which promises nothing, and falls through to the default [ImageValue](ImageValue.md).

## Type Parameters

### S

`S`
