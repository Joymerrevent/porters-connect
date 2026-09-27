[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TokenStore

# Type Alias: TokenStore

> **TokenStore** = `object`

Defined in: [src/auth/types.ts:53](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L53)

Pluggable token persistence (default: in-memory). Async so it can back onto
redis / DB / file for multi-instance server use. Used with every token provider.
Writes (`set` / `clear`) are made one at a time, in call order: the next one starts after the
previous one settles, so a later call is never overtaken by an earlier one. Make each call settle
(give it a timeout): one that never settles holds up every later write, including the save after a
token renewal, and the requests waiting for that renewal.

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [src/auth/types.ts:56](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L56)

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(): `Promise`\<[`StoredTokens`](StoredTokens.md) \| `undefined`\>

Defined in: [src/auth/types.ts:54](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L54)

#### Returns

`Promise`\<[`StoredTokens`](StoredTokens.md) \| `undefined`\>

***

### set()

> **set**(`tokens`): `Promise`\<`void`\>

Defined in: [src/auth/types.ts:55](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L55)

#### Parameters

##### tokens

[`StoredTokens`](StoredTokens.md)

#### Returns

`Promise`\<`void`\>
