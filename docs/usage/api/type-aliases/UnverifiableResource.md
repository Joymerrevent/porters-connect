[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / UnverifiableResource

# Type Alias: UnverifiableResource

> **UnverifiableResource** = `object`

Defined in: [src/fields/verify-fields.ts:55](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L55)

A resource whose catalog could not be read, so **nothing about it was checked**.

Kept apart from [MissingField](MissingField.md) on purpose. Reporting these declarations
as "missing" would be a false alarm — and a report that cries wolf stops being read.

## Properties

### cause

> `readonly` **cause**: `unknown`

Defined in: [src/fields/verify-fields.ts:58](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L58)

Whatever Field Read rejected with (a `PortersError`, typically permission or network).

***

### resource

> `readonly` **resource**: [`CustomFieldResource`](CustomFieldResource.md)

Defined in: [src/fields/verify-fields.ts:56](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L56)
