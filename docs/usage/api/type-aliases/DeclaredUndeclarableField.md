[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / DeclaredUndeclarableField

# Type Alias: DeclaredUndeclarableField

> **DeclaredUndeclarableField** = `object`

Defined in: [src/fields/verify-fields.ts:93](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L93)

Declared, but the tenant's field is one no declaration can express. `reason` says why:
`no-data-type` (the field carries no value of its own, such as Reference) and `not-declarable`
(a system-managed field) mean the declaration can never read correctly — every read is `null` —
so they clear [FieldVerification.ok](FieldVerification.md#ok). `unknown-field-type` is a type this version of the
library does not know; the declaration may well be right, so it is reported without clearing `ok`.

## Properties

### alias

> `readonly` **alias**: `string`

Defined in: [src/fields/verify-fields.ts:95](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L95)

***

### declared

> `readonly` **declared**: `DataType`

Defined in: [src/fields/verify-fields.ts:97](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L97)

The Data Type the declaration gave it.

***

### fieldType

> `readonly` **fieldType**: `number` \| `null`

Defined in: [src/fields/verify-fields.ts:99](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L99)

`Field.P_Type` exactly as PORTERS returned it; `null` when the field carried none.

***

### label?

> `readonly` `optional` **label?**: `string`

Defined in: [src/fields/verify-fields.ts:101](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L101)

PORTERS' own Field Type label, when the value is one it publishes.

***

### reason

> `readonly` **reason**: [`UndeclarableReason`](UndeclarableReason.md)

Defined in: [src/fields/verify-fields.ts:102](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L102)

***

### resource

> `readonly` **resource**: [`CustomFieldResource`](CustomFieldResource.md)

Defined in: [src/fields/verify-fields.ts:94](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L94)
