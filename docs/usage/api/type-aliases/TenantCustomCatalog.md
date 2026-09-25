[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TenantCustomCatalog

# Type Alias: TenantCustomCatalog

> **TenantCustomCatalog** = `object`

Defined in: [src/fields/tenant-catalog.ts:54](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L54)

One resource's custom fields as the tenant actually has them.

## Properties

### fields

> `readonly` **fields**: `Readonly`\<`Record`\<`string`, [`CustomDataType`](CustomDataType.md)\>\>

Defined in: [src/fields/tenant-catalog.ts:60](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L60)

Bare alias -> declared Data Type — the same shape `defineFields` produces, so it compares
directly against a declaration.

***

### names

> `readonly` **names**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [src/fields/tenant-catalog.ts:74](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L74)

Bare alias -> `Field.P_Name`, for every custom field seen (declarable or not).

Collected while the rows go past so nothing needs a second round trip. This is the **tenant's
own business vocabulary**, so it is carried but never printed unless a caller explicitly asks
(`generateFieldDecls` has it off by default). A field PORTERS returned without a name is absent.

***

### required

> `readonly` **required**: `Readonly`\<`Record`\<`string`, `boolean`\>\>

Defined in: [src/fields/tenant-catalog.ts:82](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L82)

Bare alias -> whether the tenant marks the field required (`Field.P_Required` is `1`), for
every field in [TenantCustomCatalog.fields](#fields). Any other value — `0`, absent, or one
PORTERS does not document — reads as `false`: a wrong `true` would make generated code demand
a value the tenant does not, and the caller would get a compile error with no visible reason.

***

### resource

> `readonly` **resource**: [`CustomFieldResource`](CustomFieldResource.md)

Defined in: [src/fields/tenant-catalog.ts:55](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L55)

***

### undeclarable

> `readonly` **undeclarable**: readonly [`UndeclarableField`](UndeclarableField.md)[]

Defined in: [src/fields/tenant-catalog.ts:66](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L66)

Custom fields that exist but cannot be declared. **Never silently dropped**:
an unknown Field Type means PORTERS grew a type, and nobody would notice if it vanished here.
