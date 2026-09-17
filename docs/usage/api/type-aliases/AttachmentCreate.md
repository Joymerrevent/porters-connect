[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentCreate

# Type Alias: AttachmentCreate

> **AttachmentCreate** = `object`

Defined in: [src/resources/attachment.ts:97](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L97)

Fields for creating an Attachment. `content` is the Base64 file body; the resource it attaches
to comes from `of(name)` and cannot be given here (ADR-0080 / ADR-0081).

## Properties

### content

> **content**: `string`

Defined in: [src/resources/attachment.ts:102](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L102)

***

### contentType

> **contentType**: `string`

Defined in: [src/resources/attachment.ts:100](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L100)

***

### fileName

> **fileName**: `string`

Defined in: [src/resources/attachment.ts:101](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L101)

***

### resourceId

> **resourceId**: `number`

Defined in: [src/resources/attachment.ts:99](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L99)

The record's id within the bound resource.
