[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldOptions

# Type Alias: FieldOptions\<R\>

> **FieldOptions**\<`R`\> = `object`

Defined in: [src/fields/define-fields.ts:31](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L31)

Options every builder method takes. `required: true` makes the field required in the
`create` / `createMany` input type; leave it out (or `false`) and the field stays optional,
as it always was. `update` input never requires it.

## Example

```ts
defineFields({ candidate: (f) => ({ U_score: f.number({ required: true }) }) });
```

## Type Parameters

### R

`R` *extends* `boolean` = `boolean`

## Properties

### required?

> `readonly` `optional` **required?**: `R`

Defined in: [src/fields/define-fields.ts:32](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L32)
