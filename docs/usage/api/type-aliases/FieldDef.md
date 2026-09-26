[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldDef

# Type Alias: FieldDef\<D, R\>

> **FieldDef**\<`D`, `R`\> = `object`

Defined in: [src/fields/declared-catalogs.ts:13](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L13)

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

Defined in: [src/fields/declared-catalogs.ts:14](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L14)

***

### required

> `readonly` **required**: `R`

Defined in: [src/fields/declared-catalogs.ts:16](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L16)

`true` makes the field required in `create` / `createMany` input. Type-only: no runtime check.
