[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AuthorizationUrlOptions

# Type Alias: AuthorizationUrlOptions

> **AuthorizationUrlOptions** = `object`

Defined in: [src/auth/auth-api.ts:16](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L16)

Shared options for the browser `code` / `remove` OAuth URLs (oauth.md).

## Properties

### redirectUrl

> **redirectUrl**: `string`

Defined in: [src/auth/auth-api.ts:18](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L18)

Registered Redirect URL the browser returns to (required for code/remove).

***

### scopes?

> `optional` **scopes?**: [`Scope`](Scope.md)[]

Defined in: [src/auth/auth-api.ts:20](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L20)

Scopes to grant/remove; defaults to the client's configured `scopes`.

***

### state?

> `optional` **state?**: `string`

Defined in: [src/auth/auth-api.ts:22](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/auth-api.ts#L22)

Opaque value echoed back on redirect (e.g. CSRF defense).
