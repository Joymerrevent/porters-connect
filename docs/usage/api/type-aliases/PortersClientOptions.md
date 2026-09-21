[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PortersClientOptions

# Type Alias: PortersClientOptions\<C\>

> **PortersClientOptions**\<`C`\> = `object`

Defined in: [src/client.ts:63](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L63)

Options for constructing a [PortersClient](../classes/PortersClient.md). `C` is inferred from `fields` (ADR-0023).

## Type Parameters

### C

`C` *extends* [`DeclaredCatalogs`](DeclaredCatalogs.md) = `EmptyCatalog`

## Properties

### appId?

> `optional` **appId?**: `string`

Defined in: [src/client.ts:91](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L91)

***

### appSecret?

> `optional` **appSecret?**: `string`

Defined in: [src/client.ts:92](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L92)

***

### auth?

> `optional` **auth?**: [`TokenProvider`](TokenProvider.md)

Defined in: [src/client.ts:95](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L95)

Custom auth strategy; defaults to the transparent code_direct strategy.

***

### fields?

> `optional` **fields?**: [`DefinedFields`](DefinedFields.md)\<`C`\>

Defined in: [src/client.ts:114](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L114)

Tenant custom field declarations from [defineFields](../functions/defineFields.md) (ADR-0023). Each resource's
declared `U_`/`A_` fields are merged onto its static catalog, so they decode/encode by
their declared Data Type and appear typed on reads / writes. Omit for standard `P_` only.

***

### hostname

> **hostname**: `string`

Defined in: [src/client.ts:75](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L75)

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

Defined in: [src/client.ts:82](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L82)

Port of the access point (ADR-0078). **Omit it for PORTERS** — the contract gives you a name
and the scheme decides the port. Set it only for a local fake server or a proxy:
`{ hostname: "127.0.0.1", port: 4010, scheme: "http" }`. An integer 1–65535; anything else
is rejected at construction.

***

### scheme?

> `optional` **scheme?**: [`Scheme`](Scheme.md)

Defined in: [src/client.ts:90](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L90)

URL scheme of the access point (ADR-0047). Defaults to `"https"`. Set `"http"` only for a
local fake server or a trusted tunnel: it sends every request — the OAuth token header
included — in cleartext, so the library warns once per process (loopback is not exempt).
Silence it only where cleartext is intended, with the env var
`PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1`.

***

### scopes?

> `optional` **scopes?**: [`Scope`](Scope.md)[]

Defined in: [src/client.ts:93](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L93)

***

### throttle?

> `optional` **throttle?**: [`Throttle`](Throttle.md)

Defined in: [src/client.ts:108](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L108)

Rate-limit self-restraint (ADR-0073). Defaults to the **process-wide bucket for this destination**,
so several clients aimed at the same PORTERS add up to one limit instead of one each.

Pass your own to opt out of that sharing, to run different limits, or to coordinate across
processes — a `Throttle` backed by Redis is what makes the multi-instance case honest
(ADR-0010 left that to the caller). `createThrottle()` builds the default implementation.

***

### tokenStore?

> `optional` **tokenStore?**: [`TokenStore`](TokenStore.md)

Defined in: [src/client.ts:97](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L97)

Token persistence; defaults to in-memory.

***

### transport?

> `optional` **transport?**: [`Transport`](Transport.md)

Defined in: [src/client.ts:99](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L99)

Injectable HTTP transport; defaults to a fetch-based transport.
