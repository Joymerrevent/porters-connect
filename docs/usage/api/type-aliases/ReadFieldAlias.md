[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ReadFieldAlias

# Type Alias: ReadFieldAlias\<F\>

> **ReadFieldAlias**\<`F`\> = keyof `F` & `string`

Defined in: [src/accessor/catalog.ts:55](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/catalog.ts#L55)

What a Read `field` entry may name: a **catalogued** alias — every
standard `P_` field plus the custom fields declared with `defineFields`. An
undeclared `U_`/`A_` alias is **not** accepted: `condition`, `order` and the Write inputs have
always required a declaration, and `field` follows the same rule, so custom fields follow
one rule — declare, then use.

Aliases are **bare**: the resource's prefix (`Person.` for Candidate) is a constant the
descriptor knows, so the library adds it. That makes `condition` / `order` / `field` one
vocabulary and turns a typo (`P_Nmae`) or a hand-written prefix into a compile error instead of
a request that quietly returns nothing.

The runtime stays permissive: an alias that arrives through a cast is still sent, and
a response field the catalog does not know still decodes — read it with [rawValue](../functions/rawValue.md).

## Type Parameters

### F

`F` *extends* `FieldCatalog`
