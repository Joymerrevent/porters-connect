[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / VerifyFieldsOptions

# Type Alias: VerifyFieldsOptions

> **VerifyFieldsOptions** = `object`

Defined in: [src/fields/verify-fields.ts:127](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L127)

Options for [verifyFields](../functions/verifyFields.md).

## Properties

### active?

> `readonly` `optional` **active?**: `-1` \| `0` \| `1`

Defined in: [src/fields/verify-fields.ts:134](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L134)

Field Read's `active` filter. Defaults to `-1` (every field) and should stay there: with `1`
a field that exists but is currently unused is absent from the response, and its declaration
would be reported as [MissingField](MissingField.md) — a false alarm.
