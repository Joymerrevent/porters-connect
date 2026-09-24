[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PortersClientOptions

# Type Alias: PortersClientOptions

> **PortersClientOptions** = `object`

Defined in: [src/client.ts:73](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L73)

Options for constructing a [PortersClient](../classes/PortersClient.md). App-level only: custom field declarations
belong to a partition and go to [PortersClient.tenant](../classes/PortersClient.md#tenant) as [TenantOptions](TenantOptions.md).

## Properties

### appId?

> `optional` **appId?**: `string`

Defined in: [src/client.ts:104](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L104)

***

### appSecret?

> `optional` **appSecret?**: `string`

Defined in: [src/client.ts:105](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L105)

***

### auth?

> `optional` **auth?**: [`TokenProvider`](TokenProvider.md)

Defined in: [src/client.ts:108](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L108)

Custom auth strategy; defaults to the transparent code_direct strategy.

***

### fields?

> `optional` **fields?**: `never`

Defined in: [src/client.ts:133](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L133)

**Not a client option any more.** Custom fields belong to a partition, so the
declaration goes to [PortersClient.tenant](../classes/PortersClient.md#tenant) as `tenant(id, { fields })`. Typed `never`
so a configuration object that still carries the pre-0.21 `fields` fails to compile even when
it is not a fresh literal; at runtime the constructor rejects it with [PortersConfigError](../classes/PortersConfigError.md)
rather than silently dropping the declaration (the same fail-closed stance as `hostname`).

***

### hostname

> **hostname**: `string`

Defined in: [src/client.ts:87](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L87)

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

Defined in: [src/client.ts:94](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L94)

Port of the access point. **Omit it for PORTERS** — the contract gives you a name
and the scheme decides the port. Set it only for a local fake server or a proxy:
`{ hostname: "127.0.0.1", port: 4010, scheme: "http" }`. An integer 1–65535; anything else
is rejected at construction.

***

### scheme?

> `optional` **scheme?**: [`Scheme`](Scheme.md)

Defined in: [src/client.ts:103](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L103)

URL scheme of the access point. Defaults to `"https"`. Set `"http"` only for a
local fake server or a trusted tunnel: it sends every request — the OAuth token header
included — in cleartext, so the library warns once per process (loopback is not exempt).
Silence it only where cleartext is intended, with the env var
`PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1`.

***

### scopes?

> `optional` **scopes?**: [`Scope`](Scope.md)[]

Defined in: [src/client.ts:106](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L106)

***

### throttle?

> `optional` **throttle?**: [`Throttle`](Throttle.md)

Defined in: [src/client.ts:123](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L123)

Rate-limit self-restraint. Defaults to the **process-wide bucket for this destination**,
so several clients aimed at the same PORTERS add up to one limit instead of one each.

Pass your own to opt out of that sharing, to run different limits, or to coordinate across
processes — a `Throttle` backed by Redis is what makes the multi-instance case honest; the
library leaves that to you. `createThrottle()` builds the default implementation.

***

### tokenStore?

> `optional` **tokenStore?**: [`TokenStore`](TokenStore.md)

Defined in: [src/client.ts:110](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L110)

Token persistence; defaults to in-memory.

***

### transport?

> `optional` **transport?**: [`Transport`](Transport.md)

Defined in: [src/client.ts:112](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L112)

Injectable HTTP transport; defaults to a fetch-based transport.
