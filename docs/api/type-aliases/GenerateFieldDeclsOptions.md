[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / GenerateFieldDeclsOptions

# Type Alias: GenerateFieldDeclsOptions

> **GenerateFieldDeclsOptions** = `object`

Defined in: [src/fields/generate-field-decls.ts:45](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/generate-field-decls.ts#L45)

Options for [generateFieldDecls](../functions/generateFieldDecls.md).

## Properties

### active?

> `readonly` `optional` **active?**: `-1` \| `0` \| `1`

Defined in: [src/fields/generate-field-decls.ts:52](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/generate-field-decls.ts#L52)

Field Read's `active` filter. Defaults to `1` — **in-use fields only**, which is what belongs
in a template; there is no reason to declare a field the tenant is not using. This is the
opposite of `verifyFields`, where narrowing would cause false "missing" reports
(ADR-0069, accept 時の決定).

***

### constName?

> `readonly` `optional` **constName?**: `string`

Defined in: [src/fields/generate-field-decls.ts:60](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/generate-field-decls.ts#L60)

Name of the exported constant. Defaults to `myFields`.

***

### includeNames?

> `readonly` `optional` **includeNames?**: `boolean`

Defined in: [src/fields/generate-field-decls.ts:58](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/generate-field-decls.ts#L58)

Add each field's PORTERS name (`Field.P_Name`) as a trailing comment. Off by default: the name
is the tenant's own business vocabulary, and generated declarations usually get committed, so
opting in should be a deliberate act.
