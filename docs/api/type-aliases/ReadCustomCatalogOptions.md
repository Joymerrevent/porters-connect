[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ReadCustomCatalogOptions

# Type Alias: ReadCustomCatalogOptions

> **ReadCustomCatalogOptions** = `object`

Defined in: [src/fields/tenant-catalog.ts:75](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L75)

Options for [readCustomCatalog](../functions/readCustomCatalog.md).

## Properties

### active?

> `readonly` `optional` **active?**: `-1` \| `0` \| `1`

Defined in: [src/fields/tenant-catalog.ts:84](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/tenant-catalog.ts#L84)

Field Read's `active` filter: `-1` all (default), `0` unused only, `1` in-use only.

The default is `-1` deliberately. Narrowing to `1` would hide fields that exist but are
unused, and a comparison against a declaration would then report them as **missing** — a
false alarm. `generateFieldDecls` overrides it to `1`, where "only what is in use" is what
you want in a template (ADR-0069, accept 時の決定).
