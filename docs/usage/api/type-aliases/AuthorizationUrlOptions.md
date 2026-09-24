[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AuthorizationUrlOptions

# Type Alias: AuthorizationUrlOptions

> **AuthorizationUrlOptions** = `object`

Defined in: [src/auth/auth-api.ts:15](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L15)

Shared options for the browser `code` / `remove` OAuth URLs (docs/usage/reference/authentication-api/oauth.md).

## Properties

### redirectUrl

> **redirectUrl**: `string`

Defined in: [src/auth/auth-api.ts:17](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L17)

Registered Redirect URL the browser returns to (required for code/remove).

***

### scopes?

> `optional` **scopes?**: [`Scope`](Scope.md)[]

Defined in: [src/auth/auth-api.ts:19](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L19)

Scopes to grant/remove; defaults to the client's configured `scopes`.

***

### state?

> `optional` **state?**: `string`

Defined in: [src/auth/auth-api.ts:21](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L21)

Opaque value echoed back on redirect (e.g. CSRF defense).
