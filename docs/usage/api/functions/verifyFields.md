[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / verifyFields

# Function: verifyFields()

> **verifyFields**(`source`, `fields`, `options?`): `Promise`\<[`FieldVerification`](../type-aliases/FieldVerification.md)\>

Defined in: [src/fields/verify-fields.ts:114](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/verify-fields.ts#L114)

Read each declared resource's real catalog and compare it with the declaration.

**This does not throw on a mismatch** — it returns what it found. A tenant administrator
renaming one field should not stop an application from starting; whether a mismatch is fatal is
the caller's call. Pass the result to [assertFieldsMatch](assertFieldsMatch.md) to make it fatal.

Needs the `field_r` scope. A resource whose Field Read fails lands in
[FieldVerification.unverifiable](../type-aliases/FieldVerification.md#unverifiable) rather than being reported as entirely missing.

## Parameters

### source

[`FieldCatalogSource`](../type-aliases/FieldCatalogSource.md)

### fields

[`DeclaredCatalogs`](../type-aliases/DeclaredCatalogs.md)

### options?

[`VerifyFieldsOptions`](../type-aliases/VerifyFieldsOptions.md) = `{}`

## Returns

`Promise`\<[`FieldVerification`](../type-aliases/FieldVerification.md)\>

## Example

```ts
const report = await verifyFields(porters.tenant(1), myFields);
if (!report.ok) logger.warn({ report }, "field declarations do not match the tenant");
```
