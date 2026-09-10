[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentResource

# Type Alias: AttachmentResource

> **AttachmentResource** = `object`

Defined in: [src/resources/attachment.ts:103](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L103)

## Methods

### create()

> **create**(`input`): `Promise`\<`number`\>

Defined in: [src/resources/attachment.ts:107](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L107)

Create an Attachment; resolves to the newly assigned id.

#### Parameters

##### input

[`AttachmentCreate`](AttachmentCreate.md)

#### Returns

`Promise`\<`number`\>

***

### get()

> **get**(`id`): `Promise`\<[`Attachment`](Attachment.md) \| `undefined`\>

Defined in: [src/resources/attachment.ts:105](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L105)

#### Parameters

##### id

`number`

#### Returns

`Promise`\<[`Attachment`](Attachment.md) \| `undefined`\>

***

### search()

> **search**(`query?`): `Promise`\<[`AttachmentPage`](AttachmentPage.md)\>

Defined in: [src/resources/attachment.ts:104](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L104)

#### Parameters

##### query?

[`AttachmentSearchQuery`](AttachmentSearchQuery.md)

#### Returns

`Promise`\<[`AttachmentPage`](AttachmentPage.md)\>

***

### update()

> **update**(`id`, `input`): `Promise`\<`number`\>

Defined in: [src/resources/attachment.ts:109](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L109)

Update an Attachment by id; resolves to that id.

#### Parameters

##### id

`number`

##### input

[`AttachmentUpdate`](AttachmentUpdate.md)

#### Returns

`Promise`\<`number`\>
