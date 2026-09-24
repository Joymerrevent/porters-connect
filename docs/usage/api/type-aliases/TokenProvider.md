[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TokenProvider

# Type Alias: TokenProvider

> **TokenProvider** = `object`

Defined in: [src/auth/types.ts:28](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L28)

Where tokens come from. Pass one as `tokenProvider` to obtain tokens elsewhere (for example
from a central service that holds the App Secret); leave it out for the built-in `code_direct`
flow. The client caches what these return, renews shortly before expiry, retries once on an
expired-token response, collapses concurrent renewals into one, and saves to `tokenStore`.

## Methods

### acquire()

> **acquire**(): `Promise`\<[`StoredTokens`](StoredTokens.md)\>

Defined in: [src/auth/types.ts:30](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L30)

Obtain tokens from scratch. Called first, and whenever renewal is not possible.

#### Returns

`Promise`\<[`StoredTokens`](StoredTokens.md)\>

***

### exchange()?

> `optional` **exchange**(`code`): `Promise`\<[`StoredTokens`](StoredTokens.md)\>

Defined in: [src/auth/types.ts:42](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L42)

Exchange an authorization `code` returned to your redirect URL after the browser grant.
Needed only for `porters.auth.exchangeAuthorizationCode`. PORTERS expires a `code` 30 seconds
after issuing it, so do not do slow work here.

#### Parameters

##### code

`string`

#### Returns

`Promise`\<[`StoredTokens`](StoredTokens.md)\>

***

### refresh()?

> `optional` **refresh**(`current`): `Promise`\<[`StoredTokens`](StoredTokens.md)\>

Defined in: [src/auth/types.ts:36](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L36)

Renew tokens. Called instead of [TokenProvider.acquire](#acquire) while `current.refreshToken`
is usable — or, when the issuer hands out no refresh token, whenever renewal is needed.
Leave it out to renew by calling `acquire` again.

#### Parameters

##### current

[`StoredTokens`](StoredTokens.md)

#### Returns

`Promise`\<[`StoredTokens`](StoredTokens.md)\>
