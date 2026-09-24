[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TokenStore

# Type Alias: TokenStore

> **TokenStore** = `object`

Defined in: [src/auth/types.ts:49](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L49)

Pluggable token persistence (default: in-memory). Async so it can back onto
redis / DB / file for multi-instance server use. Used with every token provider.

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [src/auth/types.ts:52](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L52)

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(): `Promise`\<[`StoredTokens`](StoredTokens.md) \| `undefined`\>

Defined in: [src/auth/types.ts:50](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L50)

#### Returns

`Promise`\<[`StoredTokens`](StoredTokens.md) \| `undefined`\>

***

### set()

> **set**(`tokens`): `Promise`\<`void`\>

Defined in: [src/auth/types.ts:51](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L51)

#### Parameters

##### tokens

[`StoredTokens`](StoredTokens.md)

#### Returns

`Promise`\<`void`\>
