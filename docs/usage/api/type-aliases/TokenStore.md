[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TokenStore

# Type Alias: TokenStore

> **TokenStore** = `object`

Defined in: [src/auth/types.ts:27](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L27)

Pluggable token persistence (default: in-memory). Async so it can back onto
redis / DB / file for multi-instance server use.

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [src/auth/types.ts:30](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L30)

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(): `Promise`\<[`StoredTokens`](StoredTokens.md) \| `undefined`\>

Defined in: [src/auth/types.ts:28](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L28)

#### Returns

`Promise`\<[`StoredTokens`](StoredTokens.md) \| `undefined`\>

***

### set()

> **set**(`tokens`): `Promise`\<`void`\>

Defined in: [src/auth/types.ts:29](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L29)

#### Parameters

##### tokens

[`StoredTokens`](StoredTokens.md)

#### Returns

`Promise`\<`void`\>
