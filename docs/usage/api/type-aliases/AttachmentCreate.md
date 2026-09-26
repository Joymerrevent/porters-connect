[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentCreate

# Type Alias: AttachmentCreate

> **AttachmentCreate** = `object`

Defined in: [src/resources/attachment.ts:89](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L89)

Fields for creating an Attachment. `content` is the Base64 file body; the resource it attaches
to comes from `of(name)` and cannot be given here.

## Properties

### content

> **content**: `string`

Defined in: [src/resources/attachment.ts:94](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L94)

***

### contentType

> **contentType**: `string`

Defined in: [src/resources/attachment.ts:92](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L92)

***

### fileName

> **fileName**: `string`

Defined in: [src/resources/attachment.ts:93](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L93)

***

### resourceId

> **resourceId**: `number`

Defined in: [src/resources/attachment.ts:91](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L91)

The record's id within the bound resource.
