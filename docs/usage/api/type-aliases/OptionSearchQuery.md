[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / OptionSearchQuery

# Type Alias: OptionSearchQuery

> **OptionSearchQuery** = `object`

Defined in: [src/resources/option.ts:50](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/option.ts#L50)

Option Read query. `alias` selects a subtree root; `level` its depth (-1 all).

## Properties

### alias?

> `optional` **alias?**: `string`

Defined in: [src/resources/option.ts:52](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/option.ts#L52)

Root alias of the subtree to read (e.g. `Option.P_Gender`). Omit for all.

***

### enabled?

> `optional` **enabled?**: `-1` \| `0` \| `1`

Defined in: [src/resources/option.ts:56](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/option.ts#L56)

-1 = all (default), 0 = unused only, 1 = in-use only.

***

### level?

> `optional` **level?**: `number`

Defined in: [src/resources/option.ts:54](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/option.ts#L54)

Depth: -1 all (default), 0 = siblings of `alias`, 1+ = descendants.
