[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldVerification

# Type Alias: FieldVerification

> **FieldVerification** = `object`

Defined in: [src/fields/verify-fields.ts:84](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L84)

What [verifyFields](../functions/verifyFields.md) found.

## Properties

### missing

> `readonly` **missing**: readonly [`MissingField`](MissingField.md)[]

Defined in: [src/fields/verify-fields.ts:94](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L94)

***

### ok

> `readonly` **ok**: `boolean`

Defined in: [src/fields/verify-fields.ts:93](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L93)

`true` when every declared resource was read and nothing needs attention — no
[FieldVerification.missing](#missing), [FieldVerification.typeMismatch](#typemismatch) or
[FieldVerification.unverifiable](#unverifiable).

`undeclared`, `undeclarable` and `requiredMismatch` do **not** clear this flag: none of them
breaks anything, they are there to be read.

***

### requiredMismatch

> `readonly` **requiredMismatch**: readonly [`RequiredMismatch`](RequiredMismatch.md)[]

Defined in: [src/fields/verify-fields.ts:99](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L99)

***

### typeMismatch

> `readonly` **typeMismatch**: readonly [`FieldTypeMismatch`](FieldTypeMismatch.md)[]

Defined in: [src/fields/verify-fields.ts:95](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L95)

***

### undeclarable

> `readonly` **undeclarable**: readonly [`UndeclarableTenantField`](UndeclarableTenantField.md)[]

Defined in: [src/fields/verify-fields.ts:98](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L98)

***

### undeclared

> `readonly` **undeclared**: readonly [`UndeclaredField`](UndeclaredField.md)[]

Defined in: [src/fields/verify-fields.ts:96](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L96)

***

### unverifiable

> `readonly` **unverifiable**: readonly [`UnverifiableResource`](UnverifiableResource.md)[]

Defined in: [src/fields/verify-fields.ts:97](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L97)
