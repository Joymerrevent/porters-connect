[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldTypeMismatch

# Type Alias: FieldTypeMismatch

> **FieldTypeMismatch** = `object`

Defined in: [src/fields/verify-fields.ts:34](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L34)

Declared with a different Data Type than the tenant actually uses. **The worst of the four**:
the value silently decodes to `null` (or throws deep in a date conversion), so nothing in the
calling code reveals that a field is being read through the wrong type.

## Properties

### actual

> `readonly` **actual**: [`CustomDataType`](CustomDataType.md)

Defined in: [src/fields/verify-fields.ts:38](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L38)

***

### alias

> `readonly` **alias**: `string`

Defined in: [src/fields/verify-fields.ts:36](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L36)

***

### declared

> `readonly` **declared**: `DataType`

Defined in: [src/fields/verify-fields.ts:37](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L37)

***

### resource

> `readonly` **resource**: [`CustomFieldResource`](CustomFieldResource.md)

Defined in: [src/fields/verify-fields.ts:35](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L35)
