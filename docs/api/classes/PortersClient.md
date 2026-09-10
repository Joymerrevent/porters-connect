[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PortersClient

# Class: PortersClient\<C\>

Defined in: [src/client.ts:140](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L140)

Entry point of the library. Wires the default transport / auth / throttle / requester and exposes
the **App-level** surface: `auth`, the `partition` master (discovery), and [PortersClient.tenant](#tenant).

Everything that PORTERS scopes to a partition (Company DB) lives behind `tenant(id)` — see
[TenantScope](../type-aliases/TenantScope.md). The client holds no default partition (ADR-0055): a partition is bound
explicitly, exactly once, so "unbound" is not a state this API can be in.

## Example

```ts
const porters = new PortersClient({ host, appId, appSecret });
await porters.auth.ensureAuthenticated();   // App-level
const t = porters.tenant(123);              // bind the partition once
const page = await t.candidate.search();
```

## Type Parameters

### C

`C` *extends* [`DeclaredCatalogs`](../type-aliases/DeclaredCatalogs.md) = `EmptyCatalog`

## Constructors

### Constructor

> **new PortersClient**\<`C`\>(`options`): `PortersClient`\<`C`\>

Defined in: [src/client.ts:165](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L165)

#### Parameters

##### options

[`PortersClientOptions`](../type-aliases/PortersClientOptions.md)\<`C`\>

#### Returns

`PortersClient`\<`C`\>

## Properties

### auth

> `readonly` **auth**: [`AuthApi`](../type-aliases/AuthApi.md)

Defined in: [src/client.ts:142](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L142)

OAuth surface: initial browser grant, token warm-up/inspection, local revoke (ADR-0007/0034).

***

### partition

> `readonly` **partition**: [`PartitionResource`](../type-aliases/PartitionResource.md)

Defined in: [src/client.ts:147](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L147)

Master Read: the partitions this App can reach (ADR-0021/0022). Takes no `partition` itself —
it is how you *discover* the ids to pass to [PortersClient.tenant](#tenant).

***

### tenant

> `readonly` **tenant**: (`id`) => [`TenantScope`](../type-aliases/TenantScope.md)\<`C`\>

Defined in: [src/client.ts:162](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L162)

Bind a partition (Company DB) and get the accessors that route through it (ADR-0040 F-3).
**Single-tenant apps use this too** — it is the only path to a partition-scoped resource
(ADR-0055). Hold the scope once and use it like a client:

```ts
const t = porters.tenant(123);
await t.candidate.search();
```

`auth` (App-level), the `partition` master (discovery — takes no partition), and `tenant`
itself (no nesting) are intentionally absent from the returned scope. For a fully separated
per-partition token, construct a dedicated PortersClient per tenant (ADR-0008 案3).

#### Parameters

##### id

`number`

#### Returns

[`TenantScope`](../type-aliases/TenantScope.md)\<`C`\>

## Accessors

### host

#### Get Signature

> **get** **host**(): `string`

Defined in: [src/client.ts:247](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L247)

The configured API host.

##### Returns

`string`
