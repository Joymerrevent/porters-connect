[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / generateFieldDecls

# Function: generateFieldDecls()

> **generateFieldDecls**(`source`, `resources`, `options?`): `Promise`\<`string`\>

Defined in: [src/fields/generate-field-decls.ts:119](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/generate-field-decls.ts#L119)

Read the given resources' custom fields and print a `defineFields` call for them.

Fields whose Field Type cannot be declared are emitted as **comments** rather than dropped
(ADR-0069 論点4), so a tenant field the library cannot yet express is visible in the output
instead of silently absent.

Writing the result to a file is the caller's job — this library does not touch the filesystem.

## Parameters

### source

[`FieldCatalogSource`](../type-aliases/FieldCatalogSource.md)

### resources

readonly [`CustomFieldResource`](../type-aliases/CustomFieldResource.md)[]

### options?

[`GenerateFieldDeclsOptions`](../type-aliases/GenerateFieldDeclsOptions.md) = `{}`

## Returns

`Promise`\<`string`\>

## Example

```ts
import { writeFile } from "node:fs/promises";

const src = await generateFieldDecls(porters.tenant(1), ["candidate", "job"]);
await writeFile("src/porters-fields.ts", src);
```
