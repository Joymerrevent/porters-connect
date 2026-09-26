[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TenantCustomCatalog

# Type Alias: TenantCustomCatalog

> **TenantCustomCatalog** = `object`

Defined in: [src/fields/read-custom-catalog.ts:51](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L51)

One resource's custom fields as the tenant actually has them.

## Properties

### fields

> `readonly` **fields**: `Readonly`\<`Record`\<`string`, [`CustomDataType`](CustomDataType.md)\>\>

Defined in: [src/fields/read-custom-catalog.ts:57](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L57)

Bare alias -> declared Data Type — the same shape `defineFields` produces, so it compares
directly against a declaration.

***

### names

> `readonly` **names**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [src/fields/read-custom-catalog.ts:71](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L71)

Bare alias -> `Field.P_Name`, for every custom field seen (declarable or not).

Collected while the rows go past so nothing needs a second round trip. This is the **tenant's
own business vocabulary**, so it is carried but never printed unless a caller explicitly asks
(`generateFieldDecls` has it off by default). A field PORTERS returned without a name is absent.

***

### required

> `readonly` **required**: `Readonly`\<`Record`\<`string`, `boolean`\>\>

Defined in: [src/fields/read-custom-catalog.ts:79](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L79)

Bare alias -> whether the tenant marks the field required (`Field.P_Required` is `1`), for
every field in [TenantCustomCatalog.fields](#fields). Any other value — `0`, absent, or one
PORTERS does not document — reads as `false`: a wrong `true` would make generated code demand
a value the tenant does not, and the caller would get a compile error with no visible reason.

***

### resource

> `readonly` **resource**: [`CustomFieldResource`](CustomFieldResource.md)

Defined in: [src/fields/read-custom-catalog.ts:52](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L52)

***

### undeclarable

> `readonly` **undeclarable**: readonly [`UndeclarableField`](UndeclarableField.md)[]

Defined in: [src/fields/read-custom-catalog.ts:63](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L63)

Custom fields that exist but cannot be declared. **Never silently dropped**:
an unknown Field Type means PORTERS grew a type, and nobody would notice if it vanished here.
