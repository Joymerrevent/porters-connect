[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PortersClientOptions

# Type Alias: PortersClientOptions

> **PortersClientOptions** = `object`

Defined in: [src/client.ts:66](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L66)

Options for constructing a [PortersClient](../classes/PortersClient.md). App-level only: custom field declarations
belong to a partition and go to [PortersClient.tenant](../classes/PortersClient.md#tenant) as [TenantOptions](TenantOptions.md) (ADR-0087).

## Properties

### appId?

> `optional` **appId?**: `string`

Defined in: [src/client.ts:94](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L94)

***

### appSecret?

> `optional` **appSecret?**: `string`

Defined in: [src/client.ts:95](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L95)

***

### auth?

> `optional` **auth?**: [`TokenProvider`](TokenProvider.md)

Defined in: [src/client.ts:98](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L98)

Custom auth strategy; defaults to the transparent code_direct strategy.

***

### hostname

> **hostname**: `string`

Defined in: [src/client.ts:78](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L78)

API server name. Required and supplied via `PORTERS_HOST` — never hard-code it.
(A representative value lives in docs/usage/reference.)

The **name and nothing else**: no port, no scheme, no path, no userinfo, no whitespace
(ADR-0078). PORTERS issues a server name and speaks https, so a port never arrives with it;
when you need one (a local fake, a proxy) pass [PortersClientOptions.port](#port). A value
like `https://xxxxx.example.com` or `a.test:4010` is rejected at construction with a
[PortersConfigError](../classes/PortersConfigError.md) rather than silently addressing something else (ADR-0048).
Write a non-ASCII name in punycode; bracket an IPv6 address (`[::1]`).

***

### port?

> `optional` **port?**: `number`

Defined in: [src/client.ts:85](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L85)

Port of the access point (ADR-0078). **Omit it for PORTERS** — the contract gives you a name
and the scheme decides the port. Set it only for a local fake server or a proxy:
`{ hostname: "127.0.0.1", port: 4010, scheme: "http" }`. An integer 1–65535; anything else
is rejected at construction.

***

### scheme?

> `optional` **scheme?**: [`Scheme`](Scheme.md)

Defined in: [src/client.ts:93](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L93)

URL scheme of the access point (ADR-0047). Defaults to `"https"`. Set `"http"` only for a
local fake server or a trusted tunnel: it sends every request — the OAuth token header
included — in cleartext, so the library warns once per process (loopback is not exempt).
Silence it only where cleartext is intended, with the env var
`PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1`.

***

### scopes?

> `optional` **scopes?**: [`Scope`](Scope.md)[]

Defined in: [src/client.ts:96](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L96)

***

### throttle?

> `optional` **throttle?**: [`Throttle`](Throttle.md)

Defined in: [src/client.ts:111](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L111)

Rate-limit self-restraint (ADR-0073). Defaults to the **process-wide bucket for this destination**,
so several clients aimed at the same PORTERS add up to one limit instead of one each.

Pass your own to opt out of that sharing, to run different limits, or to coordinate across
processes — a `Throttle` backed by Redis is what makes the multi-instance case honest
(ADR-0010 left that to the caller). `createThrottle()` builds the default implementation.

***

### tokenStore?

> `optional` **tokenStore?**: [`TokenStore`](TokenStore.md)

Defined in: [src/client.ts:100](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L100)

Token persistence; defaults to in-memory.

***

### transport?

> `optional` **transport?**: [`Transport`](Transport.md)

Defined in: [src/client.ts:102](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L102)

Injectable HTTP transport; defaults to a fetch-based transport.
