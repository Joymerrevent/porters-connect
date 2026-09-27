[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentCreate

# Type Alias: AttachmentCreate

> **AttachmentCreate** = `object`

Defined in: [src/resources/attachment.ts:93](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L93)

Fields for creating an Attachment. `content` is the Base64 file body; the resource it attaches
to comes from `of(name)` and cannot be given here. Checked before sending: `resourceId` is a
positive integer, `contentType` and `fileName` are non-empty strings, and `content` is Base64
text of about 10MB or less.

## Properties

### content

> **content**: `string`

Defined in: [src/resources/attachment.ts:98](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L98)

***

### contentType

> **contentType**: `string`

Defined in: [src/resources/attachment.ts:96](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L96)

***

### fileName

> **fileName**: `string`

Defined in: [src/resources/attachment.ts:97](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L97)

***

### resourceId

> **resourceId**: `number`

Defined in: [src/resources/attachment.ts:95](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L95)

The record's id within the bound resource.
