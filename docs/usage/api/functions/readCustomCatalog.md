[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / readCustomCatalog

# Function: readCustomCatalog()

> **readCustomCatalog**(`source`, `resource`, `options?`): `Promise`\<[`TenantCustomCatalog`](../type-aliases/TenantCustomCatalog.md)\>

Defined in: [src/fields/tenant-catalog.ts:153](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L153)

Read one resource's tenant custom fields (`U_` / `A_`) from Field Read.

Standard `P_` fields are left out — they are the static catalogs' job (ADR-0019) and declaring
one is rejected by `defineFields` anyway. Fields whose Field Type cannot become a declaration
come back under `undeclarable` rather than being dropped.

## Parameters

### source

[`FieldCatalogSource`](../type-aliases/FieldCatalogSource.md)

### resource

[`CustomFieldResource`](../type-aliases/CustomFieldResource.md)

### options?

[`ReadCustomCatalogOptions`](../type-aliases/ReadCustomCatalogOptions.md) = `{}`

## Returns

`Promise`\<[`TenantCustomCatalog`](../type-aliases/TenantCustomCatalog.md)\>

## Example

```ts
const catalog = await readCustomCatalog(porters.tenant(1), "candidate");
catalog.fields; // { U_score: "Number", U_source: "Option" }
```
