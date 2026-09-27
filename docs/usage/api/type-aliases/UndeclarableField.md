[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / UndeclarableField

# Type Alias: UndeclarableField

> **UndeclarableField** = `object`

Defined in: [src/fields/read-custom-catalog.ts:52](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L52)

A custom field PORTERS reports that no `defineFields` declaration can express.

## Properties

### alias

> `readonly` **alias**: `string`

Defined in: [src/fields/read-custom-catalog.ts:54](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L54)

The bare alias (prefix stripped), e.g. `U_legacy`.

***

### fieldType

> `readonly` **fieldType**: `number` \| `null`

Defined in: [src/fields/read-custom-catalog.ts:56](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L56)

`Field.P_Type` exactly as PORTERS returned it; `null` when the field carried none.

***

### label?

> `readonly` `optional` **label?**: `string`

Defined in: [src/fields/read-custom-catalog.ts:58](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L58)

PORTERS' own Field Type label, when the value is one it publishes.

***

### reason

> `readonly` **reason**: [`UndeclarableReason`](UndeclarableReason.md)

Defined in: [src/fields/read-custom-catalog.ts:59](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/read-custom-catalog.ts#L59)
