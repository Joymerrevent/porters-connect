[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TenantScope

# Type Alias: TenantScope\<C\>

> **TenantScope**\<`C`\> = `object`

Defined in: [src/client.ts:122](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L122)

The partition-bound resource accessors returned by [PortersClient.tenant](../classes/PortersClient.md#tenant) (ADR-0040 / F-3).
**This is the only way to reach a partition-scoped resource** (ADR-0055): PORTERS requires
`partition` on every one of these calls, so the API makes you supply it exactly once, explicitly.
`auth` (App-level), the `partition` master (discovery — partition-less), and `tenant` itself
(no nesting) are deliberately absent: none of them takes a partition.

## Type Parameters

### C

`C` *extends* [`DeclaredCatalogs`](DeclaredCatalogs.md) = `EmptyCatalog`

## Properties

### activity

> `readonly` **activity**: [`ActivityResource`](ActivityResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"activity"`\>\>

Defined in: [src/client.ts:129](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L129)

***

### attachment

> `readonly` **attachment**: [`AttachmentAccessor`](AttachmentAccessor.md)

Defined in: [src/client.ts:144](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L144)

Attachments, reached through the resource they belong to: `t.attachment.of("resume")`.
PORTERS requires that `resource` on every Attachment Read, and the same value fills the
`<Resource>` field on write, so it is bound once (ADR-0080 / ADR-0081).

***

### candidate

> `readonly` **candidate**: [`CandidateResource`](CandidateResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"candidate"`\>\>

Defined in: [src/client.ts:123](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L123)

***

### client

> `readonly` **client**: [`ClientResource`](ClientResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"client"`\>\>

Defined in: [src/client.ts:125](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L125)

***

### contact

> `readonly` **contact**: [`ContactResource`](ContactResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contact"`\>\>

Defined in: [src/client.ts:127](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L127)

***

### contract

> `readonly` **contract**: [`ContractResource`](ContractResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contract"`\>\>

Defined in: [src/client.ts:130](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L130)

***

### field

> `readonly` **field**: [`FieldAccessor`](FieldAccessor.md)

Defined in: [src/client.ts:151](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L151)

Field master Read, reached through the resource whose catalog you want:
`t.field.of("candidate")`. PORTERS requires `resource=` on every Field Read, so it is bound
once (ADR-0080).

***

### job

> `readonly` **job**: [`JobResource`](JobResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"job"`\>\>

Defined in: [src/client.ts:124](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L124)

***

### opportunity

> `readonly` **opportunity**: [`OpportunityResource`](OpportunityResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"opportunity"`\>\>

Defined in: [src/client.ts:128](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L128)

***

### option

> `readonly` **option**: [`OptionResource`](OptionResource.md)

Defined in: [src/client.ts:152](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L152)

***

### phase

> `readonly` **phase**: [`PhaseAccessor`](PhaseAccessor.md)

Defined in: [src/client.ts:136](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L136)

Phase history, reached through the resource it belongs to: `t.phase.of("client")`.
PORTERS requires that `resource` on every Phase call, so it is bound once (ADR-0061 案2a).

***

### process

> `readonly` **process**: [`ProcessResource`](ProcessResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"process"`\>\>

Defined in: [src/client.ts:137](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L137)

***

### recruiter

> `readonly` **recruiter**: [`RecruiterResource`](RecruiterResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"recruiter"`\>\>

Defined in: [src/client.ts:126](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L126)

***

### resume

> `readonly` **resume**: [`ResumeResource`](ResumeResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"resume"`\>\>

Defined in: [src/client.ts:138](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L138)

***

### sales

> `readonly` **sales**: [`SalesResource`](SalesResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"sales"`\>\>

Defined in: [src/client.ts:131](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L131)

***

### user

> `readonly` **user**: [`UserResource`](UserResource.md)

Defined in: [src/client.ts:145](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L145)
