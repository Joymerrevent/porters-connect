[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PortersClientOptions

# Type Alias: PortersClientOptions

> **PortersClientOptions** = `object`

Defined in: [src/porters-client.ts:79](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L79)

Options for constructing a [PortersClient](../classes/PortersClient.md). App-level only: custom field declarations
belong to a partition and go to [PortersClient.tenant](../classes/PortersClient.md#tenant) as [TenantOptions](TenantOptions.md).

## Properties

### appId?

> `optional` **appId?**: `string`

Defined in: [src/porters-client.ts:110](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L110)

***

### appSecret?

> `optional` **appSecret?**: `string`

Defined in: [src/porters-client.ts:111](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L111)

***

### hostname

> **hostname**: `string`

Defined in: [src/porters-client.ts:93](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L93)

API server name. Required and supplied via `PORTERS_HOST` — never hard-code it.
(A representative value lives in docs/usage/reference.)

The **name and nothing else**: no port, no scheme, no path, no userinfo, no whitespace.
PORTERS issues a server name and speaks https, so a port never arrives with it;
when you need one (a local fake, a proxy) pass [PortersClientOptions.port](#port). A value
like `https://xxxxx.example.com` or `a.test:4010` is rejected at construction with a
[PortersConfigError](../classes/PortersConfigError.md) rather than silently addressing something else.
Write a non-ASCII name in punycode; bracket an IPv6 address (`[::1]`).

***

### port?

> `optional` **port?**: `number`

Defined in: [src/porters-client.ts:100](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L100)

Port of the access point. **Omit it for PORTERS** — the contract gives you a name
and the scheme decides the port. Set it only for a local fake server or a proxy:
`{ hostname: "127.0.0.1", port: 4010, scheme: "http" }`. An integer 1–65535; anything else
is rejected at construction.

***

### scheme?

> `optional` **scheme?**: [`Scheme`](Scheme.md)

Defined in: [src/porters-client.ts:109](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L109)

URL scheme of the access point. Defaults to `"https"`. Set `"http"` only for a
local fake server or a trusted tunnel: it sends every request — the OAuth token header
included — in cleartext, so the library warns once per process (loopback is not exempt).
Silence it only where cleartext is intended, with the env var
`PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1`.

***

### scopes?

> `optional` **scopes?**: [`Scope`](Scope.md)[]

Defined in: [src/porters-client.ts:112](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L112)

***

### throttle?

> `optional` **throttle?**: [`Throttle`](Throttle.md)

Defined in: [src/porters-client.ts:135](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L135)

Rate-limit self-restraint. Defaults to the **process-wide bucket for this destination**,
so several clients aimed at the same PORTERS add up to one limit instead of one each.

Pass your own to opt out of that sharing, to run different limits, or to coordinate across
processes — a `Throttle` backed by Redis is what makes the multi-instance case honest; the
library leaves that to you. `createThrottle()` builds the default implementation.

***

### tokenProvider?

> `optional` **tokenProvider?**: [`TokenProvider`](TokenProvider.md)

Defined in: [src/porters-client.ts:120](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L120)

Where tokens come from. Leave it out for the built-in flow (`code_direct` with `appId` /
`appSecret`); pass one to obtain tokens another way — for example from a central service that
holds the App Secret. Either way the client caches, renews before expiry, retries once on an
expired token, and saves to `tokenStore`.

***

### tokenStore?

> `optional` **tokenStore?**: [`TokenStore`](TokenStore.md)

Defined in: [src/porters-client.ts:122](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L122)

Token persistence, used with every token provider; defaults to in-memory.

***

### transport?

> `optional` **transport?**: [`Transport`](Transport.md)

Defined in: [src/porters-client.ts:124](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L124)

Injectable HTTP transport; defaults to a fetch-based transport.
