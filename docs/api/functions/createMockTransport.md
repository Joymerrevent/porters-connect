[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / createMockTransport

# Function: createMockTransport()

> **createMockTransport**(`handler`, `options?`): [`Transport`](../type-aliases/Transport.md)

Defined in: [src/http/mock-transport.ts:64](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/mock-transport.ts#L64)

Build a [Transport](../type-aliases/Transport.md) that answers from a handler instead of the network — run the library
fully offline, with no PORTERS contract (R-17). Pass it as `new PortersClient({ transport })`.

## Parameters

### handler

[`MockHandler`](../type-aliases/MockHandler.md)

### options?

[`MockTransportOptions`](../type-aliases/MockTransportOptions.md) = `{}`

## Returns

[`Transport`](../type-aliases/Transport.md)

## Example

```ts
const transport = createMockTransport((req) =>
  req.url.includes("/v1/candidate")
    ? `<Candidate Total="0" Count="0" Start="0"><Code>0</Code></Candidate>`
    : undefined, // unmocked -> a clear PortersConfigError
);
```
