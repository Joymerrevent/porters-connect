[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / OptionSearchQuery

# Type Alias: OptionSearchQuery

> **OptionSearchQuery** = `object`

Defined in: [src/resources/option.ts:49](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/option.ts#L49)

Option Read query. `alias` selects a subtree root; `level` its depth (-1 all).

## Properties

### alias?

> `optional` **alias?**: `string`

Defined in: [src/resources/option.ts:51](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/option.ts#L51)

Root alias of the subtree to read (e.g. `Option.P_Gender`). Omit for all.

***

### count?

> `optional` **count?**: `number`

Defined in: [src/resources/option.ts:56](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/option.ts#L56)

***

### enabled?

> `optional` **enabled?**: `-1` \| `0` \| `1`

Defined in: [src/resources/option.ts:55](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/option.ts#L55)

-1 = all (default), 0 = unused only, 1 = in-use only.

***

### level?

> `optional` **level?**: `number`

Defined in: [src/resources/option.ts:53](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/option.ts#L53)

Depth: -1 all (default), 0 = siblings of `alias`, 1+ = descendants.
