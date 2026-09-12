[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / MockHandler

# Type Alias: MockHandler

> **MockHandler** = (`request`) => [`MockReply`](MockReply.md) \| `undefined`

Defined in: [src/http/mock-transport.ts:18](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/mock-transport.ts#L18)

Maps a request to a [MockReply](MockReply.md), or returns `undefined` for "not mocked". When `undefined`
is returned (and the request is not an auto-answered auth endpoint), the transport throws a
[PortersConfigError](../classes/PortersConfigError.md) naming the request, so an unmocked route surfaces instead of silently
returning an empty response.

## Parameters

### request

[`TransportRequest`](TransportRequest.md)

## Returns

[`MockReply`](MockReply.md) \| `undefined`
