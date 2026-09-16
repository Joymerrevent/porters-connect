[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentSearchQuery

# Type Alias: AttachmentSearchQuery

> **AttachmentSearchQuery** = `object`

Defined in: [src/resources/attachment.ts:77](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L77)

## Properties

### condition?

> `optional` **condition?**: `Record`\<`string`, `string`\>

Defined in: [src/resources/attachment.ts:86](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L86)

***

### count?

> `optional` **count?**: `number`

Defined in: [src/resources/attachment.ts:87](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L87)

***

### field?

> `optional` **field?**: [`AttachmentMetaField`](AttachmentMetaField.md)[]

Defined in: [src/resources/attachment.ts:85](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L85)

Output fields — **metadata only**. Omit for all five (Id / Resource / ResourceId /
ContentType / FileName), or pass `[]` for the API-native primary-key-only response.

The file body is **not** on this list: a listing never carries it, whatever the count
(ADR-0075). Read a body with [AttachmentResource.get](AttachmentResource.md#get), one record at a time.

***

### start?

> `optional` **start?**: `number`

Defined in: [src/resources/attachment.ts:88](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L88)
