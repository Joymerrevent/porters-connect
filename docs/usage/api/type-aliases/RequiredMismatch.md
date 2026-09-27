[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / RequiredMismatch

# Type Alias: RequiredMismatch

> **RequiredMismatch** = `object`

Defined in: [src/fields/verify-fields.ts:71](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L71)

Declared `required: true` while the tenant does not mark the field required, or the reverse.
Harmless either way — reads and writes work — so it does not clear [FieldVerification.ok](FieldVerification.md#ok).
`declared: true, tenant: false` is a declaration stricter than the tenant (perhaps on purpose);
`declared: false, tenant: true` means `create` will not stop a missing value at compile time.

## Properties

### alias

> `readonly` **alias**: `string`

Defined in: [src/fields/verify-fields.ts:73](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L73)

***

### declared

> `readonly` **declared**: `boolean`

Defined in: [src/fields/verify-fields.ts:75](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L75)

Whether the declaration says `required: true`.

***

### resource

> `readonly` **resource**: [`CustomFieldResource`](CustomFieldResource.md)

Defined in: [src/fields/verify-fields.ts:72](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L72)

***

### tenant

> `readonly` **tenant**: `boolean`

Defined in: [src/fields/verify-fields.ts:77](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L77)

Whether the tenant marks the field required (`Field.P_Required` is `1`).
