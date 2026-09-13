[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentSearchQuery

# Type Alias: AttachmentSearchQuery

> **AttachmentSearchQuery** = `object`

Defined in: [src/resources/attachment.ts:74](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L74)

## Properties

### condition?

> `optional` **condition?**: `Record`\<`string`, `string`\>

Defined in: [src/resources/attachment.ts:82](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L82)

***

### count?

> `optional` **count?**: `number`

Defined in: [src/resources/attachment.ts:83](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L83)

***

### field?

> `optional` **field?**: `string`[]

Defined in: [src/resources/attachment.ts:81](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L81)

Output fields. **Omit** to fetch metadata by default (Id / Resource / ResourceId /
ContentType / FileName) — the large Base64 `Content` is excluded so listing doesn't download
every file body (ADR-0020); request `["Content", …]` or use `get()` for the body. Pass `[]`
for the API-native primary-key-only response. A non-empty list is sent verbatim.

***

### start?

> `optional` **start?**: `number`

Defined in: [src/resources/attachment.ts:84](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L84)
