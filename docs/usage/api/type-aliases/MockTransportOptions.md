[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / MockTransportOptions

# Type Alias: MockTransportOptions

> **MockTransportOptions** = `object`

Defined in: [src/http/mock-transport.ts:21](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/mock-transport.ts#L21)

Options for [createMockTransport](../functions/createMockTransport.md).

## Properties

### auth?

> `optional` **auth?**: `boolean`

Defined in: [src/http/mock-transport.ts:27](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/mock-transport.ts#L27)

Auto-answer the OAuth `code_direct` (`/v1/oauth`) and token (`/v1/token`) endpoints with valid
demo tokens, so callers only mock resource XML. Default `true`. Set `false` to handle the auth
endpoints in your own handler.
