[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / assertFieldsMatch

# Function: assertFieldsMatch()

> **assertFieldsMatch**(`report`): `void`

Defined in: [src/fields/verify-fields.ts:320](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L320)

Throw unless [verifyFields](verifyFields.md) came back clean — for callers who would rather fail at startup
than read a `null` in production.

Throws [PortersConfigError](../classes/PortersConfigError.md) (`category: "config"`) for a mismatch, a missing field, a declared
field the tenant's type cannot express, **or a resource that could not be read**. That last one is deliberate: "we could not check" is not
"everything is fine", and passing it silently would defeat the point of asking.

`undeclared` / `undeclarable` / `requiredMismatch` never throw — nothing is broken by any of them.

## Parameters

### report

[`FieldVerification`](../type-aliases/FieldVerification.md)

## Returns

`void`

## Example

```ts
assertFieldsMatch(await verifyFields(porters.tenant(1), myFields));
```
