[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldVerification

# Type Alias: FieldVerification

> **FieldVerification** = `object`

Defined in: [src/fields/verify-fields.ts:66](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L66)

What [verifyFields](../functions/verifyFields.md) found.

## Properties

### missing

> `readonly` **missing**: readonly [`MissingField`](MissingField.md)[]

Defined in: [src/fields/verify-fields.ts:76](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L76)

***

### ok

> `readonly` **ok**: `boolean`

Defined in: [src/fields/verify-fields.ts:75](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L75)

`true` when every declared resource was read and nothing needs attention — no
[FieldVerification.missing](#missing), [FieldVerification.typeMismatch](#typemismatch) or
[FieldVerification.unverifiable](#unverifiable).

`undeclared` and `undeclarable` do **not** clear this flag: neither breaks anything, they are
there to be read.

***

### typeMismatch

> `readonly` **typeMismatch**: readonly [`FieldTypeMismatch`](FieldTypeMismatch.md)[]

Defined in: [src/fields/verify-fields.ts:77](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L77)

***

### undeclarable

> `readonly` **undeclarable**: readonly [`UndeclarableTenantField`](UndeclarableTenantField.md)[]

Defined in: [src/fields/verify-fields.ts:80](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L80)

***

### undeclared

> `readonly` **undeclared**: readonly [`UndeclaredField`](UndeclaredField.md)[]

Defined in: [src/fields/verify-fields.ts:78](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L78)

***

### unverifiable

> `readonly` **unverifiable**: readonly [`UnverifiableResource`](UnverifiableResource.md)[]

Defined in: [src/fields/verify-fields.ts:79](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L79)
