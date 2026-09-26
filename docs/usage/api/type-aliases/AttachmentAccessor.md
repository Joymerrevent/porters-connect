[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / AttachmentAccessor

# Type Alias: AttachmentAccessor

> **AttachmentAccessor** = `object`

Defined in: [src/resources/attachment.ts:114](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L114)

Attachments are reached through the resource they belong to:

```ts
const files = t.attachment.of("resume");
await files.search({ resourceId: 10006 }); // metadata only
await files.get(900); // with the file body
```

PORTERS requires `resource=` on every Attachment Read, and the same value goes into the
`<Resource>` field on write — one binding, both places, exactly like `t.phase.of(...)`.

## Methods

### of()

> **of**(`resource`): [`AttachmentResource`](AttachmentResource.md)

Defined in: [src/resources/attachment.ts:115](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/attachment.ts#L115)

#### Parameters

##### resource

`"candidate"` \| `"job"` \| `"client"` \| `"process"` \| `"recruiter"` \| `"sales"` \| `"contract"` \| `"resume"` \| `"activity"` \| `"opportunity"` \| `"contact"`

#### Returns

[`AttachmentResource`](AttachmentResource.md)
