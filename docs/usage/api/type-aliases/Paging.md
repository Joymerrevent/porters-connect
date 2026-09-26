[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / Paging

# Type Alias: Paging

> **Paging** = [`Limit`](Limit.md) & `object`

Defined in: [src/accessor/paging.ts:17](https://github.com/Joymerrevent/porters-connect/blob/main/src/accessor/paging.ts#L17)

Which page a Read returns: up to `count` records starting at `start` (0-based). `search` takes
it next to the query; `searchAll` walks the pages itself and does not.

## Type Declaration

### start?

> `optional` **start?**: `number`
