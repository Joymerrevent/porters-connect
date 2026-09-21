[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ImageWriteValue

# Type Alias: ImageWriteValue

> **ImageWriteValue** = `object`

Defined in: [src/xml/encode.ts:61](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/encode.ts#L61)

An Image field's write value: the three sub-elements PORTERS' Write format
names, with `Content` Base64-encoded. All three are **required** — PORTERS' sample writes the
full element and the library has no basis for a partial write; a value is either supplied whole
or the field is omitted (`null` / `undefined`, like every other field).

The keys are spelled exactly as they read back, so a read value feeds straight back into a write
— **once its sub-tags are known to be present**. A read part is `string | null` (null = requested
but empty) and there is nothing to write for a null, so that check is the caller's.

Size / name-length / MIME are checked **before the request goes out** (the ~15000-char request
guard is lifted for an image write, so this is what replaces it).

There is no way to *clear* an image. Whether empty sub-elements erase the value or
are rejected is not documented, and guessing wrong would mean thinking a value was cleared
when it was not — so the library does not offer it.

## Properties

### Content

> **Content**: `string`

Defined in: [src/xml/encode.ts:64](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/encode.ts#L64)

***

### ContentType

> **ContentType**: [`ImageContentType`](ImageContentType.md)

Defined in: [src/xml/encode.ts:63](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/encode.ts#L63)

***

### FileName

> **FileName**: `string`

Defined in: [src/xml/encode.ts:62](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/encode.ts#L62)
