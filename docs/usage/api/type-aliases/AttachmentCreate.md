[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentCreate

# Type Alias: AttachmentCreate

> **AttachmentCreate** = `object`

Defined in: [src/resources/attachment.ts:85](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L85)

Fields for creating an Attachment. `content` is the Base64 file body; the resource it attaches
to comes from `of(name)` and cannot be given here.

## Properties

### content

> **content**: `string`

Defined in: [src/resources/attachment.ts:90](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L90)

***

### contentType

> **contentType**: `string`

Defined in: [src/resources/attachment.ts:88](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L88)

***

### fileName

> **fileName**: `string`

Defined in: [src/resources/attachment.ts:89](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L89)

***

### resourceId

> **resourceId**: `number`

Defined in: [src/resources/attachment.ts:87](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L87)

The record's id within the bound resource.
