[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TenantCustomCatalog

# Type Alias: TenantCustomCatalog

> **TenantCustomCatalog** = `object`

Defined in: [src/fields/tenant-catalog.ts:52](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L52)

One resource's custom fields as the tenant actually has them.

## Properties

### fields

> `readonly` **fields**: `Readonly`\<`Record`\<`string`, [`CustomDataType`](CustomDataType.md)\>\>

Defined in: [src/fields/tenant-catalog.ts:58](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L58)

Bare alias -> declared Data Type — the same shape `defineFields` produces, so it compares
directly against a declaration.

***

### names

> `readonly` **names**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [src/fields/tenant-catalog.ts:71](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L71)

Bare alias -> `Field.P_Name`, for every custom field seen (declarable or not).

Collected while the rows go past so nothing needs a second round trip. This is the **tenant's
own business vocabulary**, so it is carried but never printed unless a caller explicitly asks
(`generateFieldDecls` has it off by default). A field PORTERS returned without a name is absent.

***

### resource

> `readonly` **resource**: [`CustomFieldResource`](CustomFieldResource.md)

Defined in: [src/fields/tenant-catalog.ts:53](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L53)

***

### undeclarable

> `readonly` **undeclarable**: readonly [`UndeclarableField`](UndeclarableField.md)[]

Defined in: [src/fields/tenant-catalog.ts:63](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L63)

Custom fields that exist but cannot be declared. **Never silently dropped** (ADR-0069 論点4):
an unknown Field Type means PORTERS grew a type, and nobody would notice if it vanished here.
