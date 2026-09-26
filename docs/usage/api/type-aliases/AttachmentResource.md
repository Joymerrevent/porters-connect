[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentResource

# Type Alias: AttachmentResource

> **AttachmentResource** = `object`

Defined in: [src/resources/attachment.ts:122](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L122)

## Methods

### create()

> **create**(`input`): `Promise`\<`number`\>

Defined in: [src/resources/attachment.ts:137](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L137)

Create an Attachment; resolves to the newly assigned id.

#### Parameters

##### input

[`AttachmentCreate`](AttachmentCreate.md)

#### Returns

`Promise`\<`number`\>

***

### get()

> **get**(`id`): `Promise`\<[`Attachment`](Attachment.md) \| `undefined`\>

Defined in: [src/resources/attachment.ts:135](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L135)

Read one attachment **with its body** (`content`). This is the only method that carries it:
one record at a time is a size PORTERS' own 10MB-per-file limit keeps readable.

#### Parameters

##### id

`number`

#### Returns

`Promise`\<[`Attachment`](Attachment.md) \| `undefined`\>

***

### search()

> **search**(`query?`): `Promise`\<[`AttachmentPage`](AttachmentPage.md)\>

Defined in: [src/resources/attachment.ts:123](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L123)

#### Parameters

##### query?

[`AttachmentSearchQuery`](AttachmentSearchQuery.md) & [`Limit`](Limit.md) & `object`

#### Returns

`Promise`\<[`AttachmentPage`](AttachmentPage.md)\>

***

### searchAll()

> **searchAll**(`query?`): `AsyncIterable`\<[`Attachment`](Attachment.md)\>

Defined in: [src/resources/attachment.ts:130](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L130)

Auto-paginating search: yields every matching attachment (200 per page). Metadata only —
the body stays behind [AttachmentResource.get](#get), so walking every attachment
in a partition never drags the files along with it.

#### Parameters

##### query?

[`AttachmentSearchQuery`](AttachmentSearchQuery.md)

#### Returns

`AsyncIterable`\<[`Attachment`](Attachment.md)\>

***

### update()

> **update**(`id`, `input`): `Promise`\<`number`\>

Defined in: [src/resources/attachment.ts:139](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L139)

Update an Attachment by id; resolves to that id.

#### Parameters

##### id

`number`

##### input

[`AttachmentUpdate`](AttachmentUpdate.md)

#### Returns

`Promise`\<`number`\>
