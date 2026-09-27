[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldVerification

# Type Alias: FieldVerification

> **FieldVerification** = `object`

Defined in: [src/fields/verify-fields.ts:106](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L106)

What [verifyFields](../functions/verifyFields.md) found.

## Properties

### declaredUndeclarable

> `readonly` **declaredUndeclarable**: readonly [`DeclaredUndeclarableField`](DeclaredUndeclarableField.md)[]

Defined in: [src/fields/verify-fields.ts:123](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L123)

***

### missing

> `readonly` **missing**: readonly [`MissingField`](MissingField.md)[]

Defined in: [src/fields/verify-fields.ts:117](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L117)

***

### ok

> `readonly` **ok**: `boolean`

Defined in: [src/fields/verify-fields.ts:116](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L116)

`true` when every declared resource was read and nothing needs attention — no
[FieldVerification.missing](#missing), [FieldVerification.typeMismatch](#typemismatch),
[FieldVerification.unverifiable](#unverifiable), and no [FieldVerification.declaredUndeclarable](#declaredundeclarable)
whose reason is `no-data-type` or `not-declarable`.

`undeclared`, `undeclarable` and `requiredMismatch` do **not** clear this flag: none of them
breaks anything, they are there to be read.

***

### requiredMismatch

> `readonly` **requiredMismatch**: readonly [`RequiredMismatch`](RequiredMismatch.md)[]

Defined in: [src/fields/verify-fields.ts:122](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L122)

***

### typeMismatch

> `readonly` **typeMismatch**: readonly [`FieldTypeMismatch`](FieldTypeMismatch.md)[]

Defined in: [src/fields/verify-fields.ts:118](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L118)

***

### undeclarable

> `readonly` **undeclarable**: readonly [`UndeclarableTenantField`](UndeclarableTenantField.md)[]

Defined in: [src/fields/verify-fields.ts:121](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L121)

***

### undeclared

> `readonly` **undeclared**: readonly [`UndeclaredField`](UndeclaredField.md)[]

Defined in: [src/fields/verify-fields.ts:119](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L119)

***

### unverifiable

> `readonly` **unverifiable**: readonly [`UnverifiableResource`](UnverifiableResource.md)[]

Defined in: [src/fields/verify-fields.ts:120](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L120)
