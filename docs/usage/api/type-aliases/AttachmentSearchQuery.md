[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentSearchQuery

# Type Alias: AttachmentSearchQuery

> **AttachmentSearchQuery** = `object`

Defined in: [src/resources/attachment.ts:72](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L72)

## Properties

### resourceId?

> `optional` **resourceId?**: `number`

Defined in: [src/resources/attachment.ts:78](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L78)

Narrow to one record's attachments — the id **within the bound resource**
(`t.attachment.of("resume")` -> a `Resume.P_Id`). Omit to read the whole resource's
attachments.
