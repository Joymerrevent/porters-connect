[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TenantScope

# Type Alias: TenantScope\<C\>

> **TenantScope**\<`C`\> = `object`

Defined in: [src/client.ts:103](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L103)

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

Defined in: [src/client.ts:110](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L110)

***

### attachment

> `readonly` **attachment**: [`AttachmentResource`](AttachmentResource.md)

Defined in: [src/client.ts:120](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L120)

***

### candidate

> `readonly` **candidate**: [`CandidateResource`](CandidateResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"candidate"`\>\>

Defined in: [src/client.ts:104](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L104)

***

### client

> `readonly` **client**: [`ClientResource`](ClientResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"client"`\>\>

Defined in: [src/client.ts:106](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L106)

***

### contact

> `readonly` **contact**: [`ContactResource`](ContactResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contact"`\>\>

Defined in: [src/client.ts:108](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L108)

***

### contract

> `readonly` **contract**: [`ContractResource`](ContractResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contract"`\>\>

Defined in: [src/client.ts:111](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L111)

***

### field

> `readonly` **field**: [`FieldResource`](FieldResource.md)

Defined in: [src/client.ts:122](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L122)

***

### job

> `readonly` **job**: [`JobResource`](JobResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"job"`\>\>

Defined in: [src/client.ts:105](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L105)

***

### opportunity

> `readonly` **opportunity**: [`OpportunityResource`](OpportunityResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"opportunity"`\>\>

Defined in: [src/client.ts:109](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L109)

***

### option

> `readonly` **option**: [`OptionResource`](OptionResource.md)

Defined in: [src/client.ts:123](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L123)

***

### phase

> `readonly` **phase**: [`PhaseAccessor`](PhaseAccessor.md)

Defined in: [src/client.ts:117](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L117)

Phase history, reached through the resource it belongs to: `t.phase.of("client")`.
PORTERS requires that `resource` on every Phase call, so it is bound once (ADR-0061 案2a).

***

### process

> `readonly` **process**: [`ProcessResource`](ProcessResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"process"`\>\>

Defined in: [src/client.ts:118](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L118)

***

### recruiter

> `readonly` **recruiter**: [`RecruiterResource`](RecruiterResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"recruiter"`\>\>

Defined in: [src/client.ts:107](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L107)

***

### resume

> `readonly` **resume**: [`ResumeResource`](ResumeResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"resume"`\>\>

Defined in: [src/client.ts:119](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L119)

***

### sales

> `readonly` **sales**: [`SalesResource`](SalesResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"sales"`\>\>

Defined in: [src/client.ts:112](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L112)

***

### user

> `readonly` **user**: [`UserResource`](UserResource.md)

Defined in: [src/client.ts:121](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L121)
