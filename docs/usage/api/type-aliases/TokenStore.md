[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TokenStore

# Type Alias: TokenStore

> **TokenStore** = `object`

Defined in: [src/auth/types.ts:51](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L51)

Pluggable token persistence (default: in-memory). Async so it can back onto
redis / DB / file for multi-instance server use. Used with every token provider.
Writes (`set` / `clear`) are made one at a time, in call order: the next one starts after the
previous one settles, so the store ends with the value of the last call.

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [src/auth/types.ts:54](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L54)

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(): `Promise`\<[`StoredTokens`](StoredTokens.md) \| `undefined`\>

Defined in: [src/auth/types.ts:52](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L52)

#### Returns

`Promise`\<[`StoredTokens`](StoredTokens.md) \| `undefined`\>

***

### set()

> **set**(`tokens`): `Promise`\<`void`\>

Defined in: [src/auth/types.ts:53](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L53)

#### Parameters

##### tokens

[`StoredTokens`](StoredTokens.md)

#### Returns

`Promise`\<`void`\>
