[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentCreate

# Type Alias: AttachmentCreate

> **AttachmentCreate** = `object`

Defined in: [src/resources/attachment.ts:95](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L95)

Fields for creating an Attachment. `content` is the Base64 file body; the resource it attaches
to comes from `of(name)` and cannot be given here.

## Properties

### content

> **content**: `string`

Defined in: [src/resources/attachment.ts:100](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L100)

***

### contentType

> **contentType**: `string`

Defined in: [src/resources/attachment.ts:98](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L98)

***

### fileName

> **fileName**: `string`

Defined in: [src/resources/attachment.ts:99](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L99)

***

### resourceId

> **resourceId**: `number`

Defined in: [src/resources/attachment.ts:97](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L97)

The record's id within the bound resource.
