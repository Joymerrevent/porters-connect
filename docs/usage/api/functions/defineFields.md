[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / defineFields

# Function: defineFields()

> **defineFields**\<`D`\>(`decls`): [`DefinedFields`](../type-aliases/DefinedFields.md)\<`DeclaredCatalogsOf`\<`D`\> & [`DeclaredRequiredOf`](../type-aliases/DeclaredRequiredOf.md)\<`D`\>\>

Defined in: [src/fields/define-fields.ts:287](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L287)

Declare tenant-specific custom fields per data resource. This is the validation
boundary: it throws [PortersConfigError](../classes/PortersConfigError.md) synchronously for an unknown resource key or an
alias that is not `U_`/`A_`-prefixed. The branded result is passed to the partition it describes,
`porters.tenant(id, { fields })`, which merges each catalog into the resource so the
custom fields decode/encode by their declared Data Type and appear typed on reads / writes.

## Type Parameters

### D

`D` *extends* [`FieldDecls`](../type-aliases/FieldDecls.md)

## Parameters

### decls

`D`

## Returns

[`DefinedFields`](../type-aliases/DefinedFields.md)\<`DeclaredCatalogsOf`\<`D`\> & [`DeclaredRequiredOf`](../type-aliases/DeclaredRequiredOf.md)\<`D`\>\>

## Example

```ts
const myFields = defineFields({
  candidate: (f) => ({ U_score: f.number(), U_source: f.option() }),
});
const t = porters.tenant(1, { fields: myFields });
```
