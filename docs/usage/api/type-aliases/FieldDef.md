[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldDef

# Type Alias: FieldDef\<D, R\>

> **FieldDef**\<`D`, `R`\> = `object`

Defined in: [src/fields/define-fields.ts:16](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L16)

One custom field's declaration — the builder's return value: its Data Type and whether
`create` requires it.

## Type Parameters

### D

`D` *extends* `DataType`

### R

`R` *extends* `boolean` = `false`

## Properties

### dataType

> `readonly` **dataType**: `D`

Defined in: [src/fields/define-fields.ts:17](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L17)

***

### required

> `readonly` **required**: `R`

Defined in: [src/fields/define-fields.ts:19](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L19)

`true` makes the field required in `create` / `createMany` input. Type-only: no runtime check.
