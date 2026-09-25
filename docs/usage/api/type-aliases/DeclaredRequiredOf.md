[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / DeclaredRequiredOf

# Type Alias: DeclaredRequiredOf\<D\>

> **DeclaredRequiredOf**\<`D`\> = `object`

Defined in: [src/fields/define-fields.ts:165](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L165)

Per declared resource, the aliases declared `required: true` — carried on the type only.

## Type Parameters

### D

`D` *extends* [`FieldDecls`](FieldDecls.md)

## Properties

### \[requiredOnCreateBrand\]

> `readonly` **\[requiredOnCreateBrand\]**: `{ [R in keyof D]: D[R] extends (f: FieldBuilder) => infer Out ? Out extends ResourceDecl ? RequiredAliasesOf<Out> : never : never }`

Defined in: [src/fields/define-fields.ts:166](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L166)
