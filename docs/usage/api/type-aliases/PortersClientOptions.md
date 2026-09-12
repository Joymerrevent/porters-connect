[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PortersClientOptions

# Type Alias: PortersClientOptions\<C\>

> **PortersClientOptions**\<`C`\> = `object`

Defined in: [src/client.ts:60](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L60)

Options for constructing a [PortersClient](../classes/PortersClient.md). `C` is inferred from `fields` (ADR-0023).

## Type Parameters

### C

`C` *extends* [`DeclaredCatalogs`](DeclaredCatalogs.md) = `EmptyCatalog`

## Properties

### appId?

> `optional` **appId?**: `string`

Defined in: [src/client.ts:79](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L79)

***

### appSecret?

> `optional` **appSecret?**: `string`

Defined in: [src/client.ts:80](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L80)

***

### auth?

> `optional` **auth?**: [`TokenProvider`](TokenProvider.md)

Defined in: [src/client.ts:83](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L83)

Custom auth strategy; defaults to the transparent code_direct strategy.

***

### fields?

> `optional` **fields?**: [`DefinedFields`](DefinedFields.md)\<`C`\>

Defined in: [src/client.ts:93](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L93)

Tenant custom field declarations from [defineFields](../functions/defineFields.md) (ADR-0023). Each resource's
declared `U_`/`A_` fields are merged onto its static catalog, so they decode/encode by
their declared Data Type and appear typed on reads / writes. Omit for standard `P_` only.

***

### host

> **host**: `string`

Defined in: [src/client.ts:70](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L70)

API host. Required and supplied via `PORTERS_HOST` — never hard-code it.
(A representative value lives in docs/usage/reference.) May carry a port — `localhost:4010`.

The **host and nothing else**: no scheme, no path, no userinfo, no whitespace. A value like
`https://xxxxx.example.com` is rejected at construction with a [PortersConfigError](../classes/PortersConfigError.md)
rather than silently addressing a different host (ADR-0048). Any port is fine — including a
redundant `:443` (ADR-0049). Write a non-ASCII host in punycode.

***

### scheme?

> `optional` **scheme?**: [`Scheme`](Scheme.md)

Defined in: [src/client.ts:78](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L78)

URL scheme of the access point (ADR-0047). Defaults to `"https"`. Set `"http"` only for a
local fake server or a trusted tunnel: it sends every request — the OAuth token header
included — in cleartext, so the library warns once per process (loopback is not exempt).
Silence it only where cleartext is intended, with the env var
`PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1`.

***

### scopes?

> `optional` **scopes?**: [`Scope`](Scope.md)[]

Defined in: [src/client.ts:81](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L81)

***

### tokenStore?

> `optional` **tokenStore?**: [`TokenStore`](TokenStore.md)

Defined in: [src/client.ts:85](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L85)

Token persistence; defaults to in-memory.

***

### transport?

> `optional` **transport?**: [`Transport`](Transport.md)

Defined in: [src/client.ts:87](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L87)

Injectable HTTP transport; defaults to a fetch-based transport.
