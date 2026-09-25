[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentSearchQuery

# Type Alias: AttachmentSearchQuery

> **AttachmentSearchQuery** = `object`

Defined in: [src/resources/attachment.ts:73](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L73)

## Properties

### count?

> `optional` **count?**: `number`

Defined in: [src/resources/attachment.ts:80](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L80)

***

### resourceId?

> `optional` **resourceId?**: `number`

Defined in: [src/resources/attachment.ts:79](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L79)

Narrow to one record's attachments — the id **within the bound resource**
(`t.attachment.of("resume")` -> a `Resume.P_Id`). Omit to read the whole resource's
attachments.

***

### start?

> `optional` **start?**: `number`

Defined in: [src/resources/attachment.ts:81](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L81)
