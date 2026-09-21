[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / UndeclarableField

# Type Alias: UndeclarableField

> **UndeclarableField** = `object`

Defined in: [src/fields/tenant-catalog.ts:44](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L44)

A custom field PORTERS reports that no `defineFields` declaration can express.

## Properties

### alias

> `readonly` **alias**: `string`

Defined in: [src/fields/tenant-catalog.ts:46](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L46)

The bare alias (prefix stripped), e.g. `U_legacy`.

***

### fieldType

> `readonly` **fieldType**: `number` \| `null`

Defined in: [src/fields/tenant-catalog.ts:48](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L48)

`Field.P_Type` exactly as PORTERS returned it; `null` when the field carried none.

***

### label?

> `readonly` `optional` **label?**: `string`

Defined in: [src/fields/tenant-catalog.ts:50](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L50)

PORTERS' own Field Type label, when the value is one it publishes.

***

### reason

> `readonly` **reason**: [`UndeclarableReason`](UndeclarableReason.md)

Defined in: [src/fields/tenant-catalog.ts:51](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L51)
