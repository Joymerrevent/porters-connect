[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PortersClient

# Class: PortersClient

Defined in: [src/client.ts:321](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L321)

Entry point of the library. Wires the default transport / auth / throttle / requester and exposes
the **App-level** surface: `auth`, the `partition` master (discovery), and [PortersClient.tenant](#tenant).

Everything that PORTERS scopes to a partition (Company DB) lives behind `tenant(id)` — see
[TenantScope](../type-aliases/TenantScope.md). The client holds no default partition and no custom field
declaration: both are bound explicitly, exactly once, at `tenant(id, { fields })`,
so "unbound" and "declared for some other tenant" are not states this API can be in.

## Example

```ts
const porters = new PortersClient({ hostname, appId, appSecret });
await porters.auth.ensureAuthenticated();   // App-level
const t = porters.tenant(123, { fields: myFields }); // bind the partition (and its fields) once
const page = await t.candidate.search();
```

## Constructors

### Constructor

> **new PortersClient**(`options`): `PortersClient`

Defined in: [src/client.ts:362](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L362)

#### Parameters

##### options

[`PortersClientOptions`](../type-aliases/PortersClientOptions.md)

#### Returns

`PortersClient`

## Properties

### auth

> `readonly` **auth**: [`AuthApi`](../type-aliases/AuthApi.md)

Defined in: [src/client.ts:324](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L324)

OAuth surface: initial browser grant, token warm-up/inspection, local revoke.

***

### partition

> `readonly` **partition**: [`PartitionResource`](../type-aliases/PartitionResource.md)

Defined in: [src/client.ts:330](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L330)

Master Read: the partitions this App can reach. Takes no `partition` itself —
it is how you *discover* the ids to pass to [PortersClient.tenant](#tenant).

***

### tenant

> `readonly` **tenant**: \<`C`\>(`id`, `options?`) => [`TenantScope`](../type-aliases/TenantScope.md)\<`C`\>

Defined in: [src/client.ts:356](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L356)

Bind a partition (Company DB) and get the accessors that route through it.
**Single-tenant apps use this too** — it is the only path to a partition-scoped resource.
Hold the scope once and use it like a client:

```ts
const t = porters.tenant(123);
await t.candidate.search();
```

That partition's custom fields are declared here as well, since PORTERS defines
them per partition — see [TenantOptions](../type-aliases/TenantOptions.md). Tenants with different fields share one
client (and one token):

```ts
const a = porters.tenant(1, { fields: fieldsA });
const b = porters.tenant(2, { fields: fieldsB });
```

`auth` (App-level), the `partition` master (discovery — takes no partition), and `tenant`
itself (no nesting) are intentionally absent from the returned scope. For a fully separated
per-partition token, construct a dedicated PortersClient per tenant.

#### Type Parameters

##### C

`C` *extends* [`DeclaredCatalogs`](../type-aliases/DeclaredCatalogs.md) = `EmptyCatalog`

#### Parameters

##### id

`number`

##### options?

[`TenantOptions`](../type-aliases/TenantOptions.md)\<`C`\>

#### Returns

[`TenantScope`](../type-aliases/TenantScope.md)\<`C`\>

## Accessors

### hostname

#### Get Signature

> **get** **hostname**(): `string`

Defined in: [src/client.ts:459](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L459)

The configured API server name (no port — see [PortersClient.port](#port)).

##### Returns

`string`

***

### port

#### Get Signature

> **get** **port**(): `number` \| `undefined`

Defined in: [src/client.ts:464](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L464)

The configured port, or `undefined` when the scheme's own port is used.

##### Returns

`number` \| `undefined`
