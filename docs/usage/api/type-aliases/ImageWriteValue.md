[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ImageWriteValue

# Type Alias: ImageWriteValue

> **ImageWriteValue** = `object`

Defined in: [src/xml/encode.ts:56](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/encode.ts#L56)

An Image field's write value (ADR-0064 論点3): the three sub-elements PORTERS' Write format
names, with `Content` Base64-encoded. All three are **required** — PORTERS' sample writes the
full element and the library has no basis for a partial write; a value is either supplied whole
or the field is omitted (`null` / `undefined`, like every other field).

The keys are spelled exactly as they read back, so a read value feeds straight back into a write
— **once its sub-tags are known to be present**. A read part is `string | null` (null = requested
but empty) and there is nothing to write for a null, so that check is the caller's.

Size / name-length / MIME are checked **before the request goes out** (the ~15000-char request
guard is lifted for an image write, so this is what replaces it).

VERIFY(live): there is no way to *clear* an image. Whether empty sub-elements erase the value or
are rejected is not written down, and guessing wrong would mean thinking a value was cleared
when it was not — docs/live-verification.md (LV-22).

## Properties

### Content

> **Content**: `string`

Defined in: [src/xml/encode.ts:59](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/encode.ts#L59)

***

### ContentType

> **ContentType**: [`ImageContentType`](ImageContentType.md)

Defined in: [src/xml/encode.ts:58](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/encode.ts#L58)

***

### FileName

> **FileName**: `string`

Defined in: [src/xml/encode.ts:57](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/encode.ts#L57)
