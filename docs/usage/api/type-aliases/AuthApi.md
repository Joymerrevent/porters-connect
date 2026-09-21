[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AuthApi

# Type Alias: AuthApi

> **AuthApi** = `object`

Defined in: [src/auth/auth-api.ts:36](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L36)

The `porters.auth.*` surface. The initial per-Company-DB grant
needs a human to open [AuthApi.authorizationUrl](#authorizationurl) in a browser and consent; the
library only builds the URL and exchanges the returned `code`. Day-to-day token
acquisition/refresh stays transparent (the default strategy), so most callers never
touch this surface.

## Methods

### authorizationUrl()

> **authorizationUrl**(`opts`): `string`

Defined in: [src/auth/auth-api.ts:38](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L38)

Build the browser `code`-grant URL to open for the initial permission grant.

#### Parameters

##### opts

[`AuthorizationUrlOptions`](AuthorizationUrlOptions.md)

#### Returns

`string`

***

### clearTokens()

> **clearTokens**(): `Promise`\<`void`\>

Defined in: [src/auth/auth-api.ts:54](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L54)

Forget cached + stored tokens locally. Does not de-authorize server-side.

#### Returns

`Promise`\<`void`\>

***

### ensureAuthenticated()

> **ensureAuthenticated**(): `Promise`\<`void`\>

Defined in: [src/auth/auth-api.ts:56](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L56)

Acquire a token now (startup fail-fast / warm-up); throws if auth is unavailable.

#### Returns

`Promise`\<`void`\>

***

### exchangeAuthorizationCode()

> **exchangeAuthorizationCode**(`code`): `Promise`\<`void`\>

Defined in: [src/auth/auth-api.ts:46](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L46)

Exchange a redirect `?code=` for tokens and save them into the default strategy.
Resolves `void` on success (tokens are stored internally — inspect via
[AuthApi.getToken](#gettoken)); throws on failure: [PortersConfigError](../classes/PortersConfigError.md) (missing
credentials / custom strategy), `PortersAuthError` (token-endpoint error or expired
code), or `PortersNetworkError`.

#### Parameters

##### code

`string`

#### Returns

`Promise`\<`void`\>

***

### getToken()

> **getToken**(): `Promise`\<`string`\>

Defined in: [src/auth/auth-api.ts:58](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L58)

Return the current valid Access Token (debug). The Refresh Token is never exposed.

#### Returns

`Promise`\<`string`\>

***

### revokeUrl()

> **revokeUrl**(`opts`): `string`

Defined in: [src/auth/auth-api.ts:52](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L52)

Build the browser `remove`-grant URL to open for server-side de-authorization.
PORTERS has no server-to-server removal, so completing it stays a browser step;
pair with [AuthApi.clearTokens](#cleartokens) to drop the local copy.

#### Parameters

##### opts

[`AuthorizationUrlOptions`](AuthorizationUrlOptions.md)

#### Returns

`string`
