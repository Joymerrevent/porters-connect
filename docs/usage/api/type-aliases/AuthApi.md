[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AuthApi

# Type Alias: AuthApi

> **AuthApi** = `object`

Defined in: [src/auth/auth-api.ts:34](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L34)

The `porters.auth.*` surface. The initial per-Company-DB grant
needs a human to open [AuthApi.authorizationUrl](#authorizationurl) in a browser and consent; the
library only builds the URL and exchanges the returned `code`. Day-to-day token
acquisition and renewal are handled by the client, whichever token provider is in use, so
most callers never touch this surface.

## Methods

### authorizationUrl()

> **authorizationUrl**(`opts`): `string`

Defined in: [src/auth/auth-api.ts:36](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L36)

Build the browser `code`-grant URL to open for the initial permission grant.

#### Parameters

##### opts

[`AuthorizationUrlOptions`](AuthorizationUrlOptions.md)

#### Returns

`string`

***

### clearTokens()

> **clearTokens**(): `Promise`\<`void`\>

Defined in: [src/auth/auth-api.ts:52](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L52)

Forget cached + stored tokens locally. Does not de-authorize server-side.

#### Returns

`Promise`\<`void`\>

***

### ensureAuthenticated()

> **ensureAuthenticated**(): `Promise`\<`void`\>

Defined in: [src/auth/auth-api.ts:54](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L54)

Acquire a token now (startup fail-fast / warm-up); throws if auth is unavailable.

#### Returns

`Promise`\<`void`\>

***

### exchangeAuthorizationCode()

> **exchangeAuthorizationCode**(`code`): `Promise`\<`void`\>

Defined in: [src/auth/auth-api.ts:44](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L44)

Exchange a redirect `?code=` for tokens through the token provider's `exchange`, and save
them (cache and `tokenStore`). Resolves `void` on success (inspect via
[AuthApi.getToken](#gettoken)); rejects with [PortersConfigError](../classes/PortersConfigError.md) when the provider has no
`exchange` or the built-in one lacks `appId` / `appSecret`, `PortersAuthError` (token-endpoint
error or expired code), or `PortersNetworkError`.

#### Parameters

##### code

`string`

#### Returns

`Promise`\<`void`\>

***

### getToken()

> **getToken**(): `Promise`\<[`IssuedToken`](IssuedToken.md)\>

Defined in: [src/auth/auth-api.ts:63](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L63)

The Access Token the client currently uses, with its expiry — renewed first when it is within
the refresh margin, exactly as a request would. `expiresAt` is epoch milliseconds, or absent
when the token provider did not report one. Use it to hand the token to another process (for
example, a central service answering its apps' `tokenProvider.acquire`). The Refresh Token is
never exposed.

#### Returns

`Promise`\<[`IssuedToken`](IssuedToken.md)\>

***

### revokeUrl()

> **revokeUrl**(`opts`): `string`

Defined in: [src/auth/auth-api.ts:50](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L50)

Build the browser `remove`-grant URL to open for server-side de-authorization.
PORTERS has no server-to-server removal, so completing it stays a browser step;
pair with [AuthApi.clearTokens](#cleartokens) to drop the local copy.

#### Parameters

##### opts

[`AuthorizationUrlOptions`](AuthorizationUrlOptions.md)

#### Returns

`string`
