[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AuthApi

# Type Alias: AuthApi

> **AuthApi** = `object`

Defined in: [src/auth/auth-api.ts:35](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L35)

The `porters.auth.*` surface. The initial per-Company-DB grant
needs a human to open [AuthApi.authorizationUrl](#authorizationurl) in a browser and consent; the
library only builds the URL and exchanges the returned `code`. Day-to-day token
acquisition and renewal are handled by the client, whichever token provider is in use, so
most callers never touch this surface.

## Methods

### authorizationUrl()

> **authorizationUrl**(`opts`): `string`

Defined in: [src/auth/auth-api.ts:37](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L37)

Build the browser `code`-grant URL to open for the initial permission grant.

#### Parameters

##### opts

[`AuthorizationUrlOptions`](AuthorizationUrlOptions.md)

#### Returns

`string`

***

### clearTokens()

> **clearTokens**(): `Promise`\<`void`\>

Defined in: [src/auth/auth-api.ts:53](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L53)

Forget cached + stored tokens locally. Does not de-authorize server-side.

#### Returns

`Promise`\<`void`\>

***

### ensureAuthenticated()

> **ensureAuthenticated**(): `Promise`\<`void`\>

Defined in: [src/auth/auth-api.ts:55](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L55)

Acquire a token now (startup fail-fast / warm-up); throws if auth is unavailable.

#### Returns

`Promise`\<`void`\>

***

### exchangeAuthorizationCode()

> **exchangeAuthorizationCode**(`code`): `Promise`\<`void`\>

Defined in: [src/auth/auth-api.ts:45](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L45)

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

> **getToken**(): `Promise`\<`string`\>

Defined in: [src/auth/auth-api.ts:57](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L57)

Return the current valid Access Token (debug). The Refresh Token is never exposed.

#### Returns

`Promise`\<`string`\>

***

### revokeUrl()

> **revokeUrl**(`opts`): `string`

Defined in: [src/auth/auth-api.ts:51](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L51)

Build the browser `remove`-grant URL to open for server-side de-authorization.
PORTERS has no server-to-server removal, so completing it stays a browser step;
pair with [AuthApi.clearTokens](#cleartokens) to drop the local copy.

#### Parameters

##### opts

[`AuthorizationUrlOptions`](AuthorizationUrlOptions.md)

#### Returns

`string`
