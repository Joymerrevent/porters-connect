[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ImageOption

# Type Alias: ImageOption\<F\>

> **ImageOption**\<`F`\> = `{ [K in ImageKeys<F>]?: readonly ImageSubField[] }`

Defined in: [src/resources/image.ts:37](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/image.ts#L37)

What `image` accepts: for each Image field, which of the three sub-tags to read. Naming a field
that is not Image-typed is a compile error, and so is an unknown sub-tag.

```ts
const page = await t.resume.search({ image: { U_photo: ["FileName", "Content"] } });
page.items[0]?.U_photo; // { FileName: string | null; Content: string | null }
```

Omitting a field (or selecting nothing) sends the bare alias, which PORTERS answers with
`FileName` alone — so a listing never drags every image body along (ADR-0064 案1a).

## Type Parameters

### F

`F` *extends* `FieldCatalog`
