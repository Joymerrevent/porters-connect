[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / GetAccessTokenOptions

# Type Alias: GetAccessTokenOptions

> **GetAccessTokenOptions** = `object`

Defined in: [src/auth/types.ts:5](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L5)

Options for [TokenProvider.getAccessToken](TokenProvider.md#getaccesstoken).

## Properties

### forceRefresh?

> `optional` **forceRefresh?**: `boolean`

Defined in: [src/auth/types.ts:7](https://github.com/Joymerrevent/porters-connect/blob/main/src/auth/types.ts#L7)

Force a refresh even if the cached token looks valid (reactive 401/402).
