[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / UndeclarableField

# Type Alias: UndeclarableField

> **UndeclarableField** = `object`

Defined in: [src/fields/read-custom-catalog.ts:40](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L40)

A custom field PORTERS reports that no `defineFields` declaration can express.

## Properties

### alias

> `readonly` **alias**: `string`

Defined in: [src/fields/read-custom-catalog.ts:42](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L42)

The bare alias (prefix stripped), e.g. `U_legacy`.

***

### fieldType

> `readonly` **fieldType**: `number` \| `null`

Defined in: [src/fields/read-custom-catalog.ts:44](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L44)

`Field.P_Type` exactly as PORTERS returned it; `null` when the field carried none.

***

### label?

> `readonly` `optional` **label?**: `string`

Defined in: [src/fields/read-custom-catalog.ts:46](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L46)

PORTERS' own Field Type label, when the value is one it publishes.

***

### reason

> `readonly` **reason**: [`UndeclarableReason`](UndeclarableReason.md)

Defined in: [src/fields/read-custom-catalog.ts:47](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L47)
