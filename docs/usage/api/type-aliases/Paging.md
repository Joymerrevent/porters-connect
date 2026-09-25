[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / Paging

# Type Alias: Paging

> **Paging** = [`Limit`](Limit.md) & `object`

Defined in: src/resources/core/paging.ts:20

Which page a Read returns: up to `count` records starting at `start` (0-based). `search` takes
it next to the query; `searchAll` walks the pages itself and does not.

## Type Declaration

### start?

> `optional` **start?**: `number`
