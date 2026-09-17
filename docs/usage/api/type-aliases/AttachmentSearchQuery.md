[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentSearchQuery

# Type Alias: AttachmentSearchQuery

> **AttachmentSearchQuery** = `object`

Defined in: [src/resources/attachment.ts:76](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L76)

## Properties

### count?

> `optional` **count?**: `number`

Defined in: [src/resources/attachment.ts:83](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L83)

***

### resourceId?

> `optional` **resourceId?**: `number`

Defined in: [src/resources/attachment.ts:82](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L82)

Narrow to one record's attachments — the id **within the bound resource**
(`t.attachment.of("resume")` -> a `Resume.P_Id`). Omit to read the whole resource's
attachments.

***

### start?

> `optional` **start?**: `number`

Defined in: [src/resources/attachment.ts:84](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L84)
