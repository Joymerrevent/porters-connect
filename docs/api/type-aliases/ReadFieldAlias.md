[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ReadFieldAlias

# Type Alias: ReadFieldAlias\<F\>

> **ReadFieldAlias**\<`F`\> = keyof `F` & `string` \| `` `U_${string}` `` \| `` `A_${string}` ``

Defined in: [src/resources/read-core.ts:116](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/read-core.ts#L116)

What a Read `field` entry may name (ADR-0059): a catalogued alias — every standard `P_` field
plus the custom fields declared with `defineFields` (ADR-0023) — or an undeclared tenant custom
field, admitted by the `U_`/`A_` naming rule `defineFields` already enforces at runtime.

Aliases are **bare**: the resource's prefix (`Person.` for Candidate) is a constant the
descriptor knows, so the library adds it. That makes `condition` / `order` / `field` one
vocabulary and turns a typo (`P_Nmae`) or a hand-written prefix into a compile error instead of
a request that quietly returns nothing.

## Type Parameters

### F

`F` *extends* `FieldCatalog`
