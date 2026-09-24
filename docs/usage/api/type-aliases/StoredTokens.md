[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / StoredTokens

# Type Alias: StoredTokens

> **StoredTokens** = `object`

Defined in: [src/auth/types.ts:16](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L16)

Tokens as obtained from a [TokenProvider](TokenProvider.md) and persisted by a [TokenStore](TokenStore.md).
`refreshToken` is present only when the issuer hands one out; a value and its expiry always
travel together.

## Properties

### accessToken

> **accessToken**: [`IssuedToken`](IssuedToken.md)

Defined in: [src/auth/types.ts:17](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L17)

***

### refreshToken?

> `optional` **refreshToken?**: [`IssuedToken`](IssuedToken.md)

Defined in: [src/auth/types.ts:18](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L18)
