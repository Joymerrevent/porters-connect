[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TenantOptions

# Type Alias: TenantOptions\<C\>

> **TenantOptions**\<`C`\> = `object`

Defined in: [src/client.ts:145](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L145)

Options for [PortersClient.tenant](../classes/PortersClient.md#tenant). `C` is inferred from `fields`.

Declared per partition, not per client, because that is how PORTERS defines custom fields:
every resource article lists `U_[Name]` / `A_[Name]` as differing per tenant (Company DB).
The scope that binds the partition is therefore the one that states its field shape — a
declaration written for one tenant cannot silently apply to another.

## Type Parameters

### C

`C` *extends* [`DeclaredCatalogs`](DeclaredCatalogs.md) = `EmptyCatalog`

## Properties

### fields?

> `optional` **fields?**: [`DefinedFields`](DefinedFields.md)\<`C`\>

Defined in: [src/client.ts:154](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L154)

This partition's custom field declarations from [defineFields](../functions/defineFields.md). Each
resource's declared `U_`/`A_` fields are merged onto its static catalog, so they decode /
encode by their declared Data Type and appear typed on reads / writes. Omit for standard
`P_` only. `generateFieldDecls` writes one from the tenant's Field Read and `verifyFields`
checks one against it — both take the same `tenant(id)` scope.
