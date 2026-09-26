[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FetchTransportOptions

# Type Alias: FetchTransportOptions

> **FetchTransportOptions** = `object`

Defined in: [src/http/fetch-transport.ts:18](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/fetch-transport.ts#L18)

## Properties

### fetchImpl?

> `optional` **fetchImpl?**: *typeof* `fetch`

Defined in: [src/http/fetch-transport.ts:36](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/fetch-transport.ts#L36)

Injectable fetch (tests / custom dispatcher). Default global fetch.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [src/http/fetch-transport.ts:34](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/fetch-transport.ts#L34)

How long one request may take, in milliseconds. Default 30,000.

**It covers the whole exchange** — connect, send, and reading the response body to the end —
because the abort signal is handed to `fetch` itself. A large download therefore hits it even
when the headers came back instantly. It is **per request**, so a retried call can take
`maxRetries + 1` times this (plus backoff), and it does not include waiting for a throttle
slot (throttling sits above the transport).

Raise it to read large attachments over a slow link; lower it to fail fast in an interactive
tool. Must be a positive integer, at most 2,147,483,647 (about 24.8 days — the longest timer
Node can set) — `0` would abort every request immediately, which reads like "no timeout" and
is not.
