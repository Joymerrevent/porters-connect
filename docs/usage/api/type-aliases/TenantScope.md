[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TenantScope

# Type Alias: TenantScope\<C\>

> **TenantScope**\<`C`\> = `object`

Defined in: [src/client.ts:141](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L141)

The partition-bound resource accessors returned by [PortersClient.tenant](../classes/PortersClient.md#tenant) (ADR-0040 / F-3).
**This is the only way to reach a partition-scoped resource** (ADR-0055): PORTERS requires
`partition` on every one of these calls, so the API makes you supply it exactly once, explicitly.
`C` is that partition's custom field catalog, from `tenant(id, { fields })` (ADR-0087).
`auth` (App-level), the `partition` master (discovery — partition-less), and `tenant` itself
(no nesting) are deliberately absent: none of them takes a partition.

## Type Parameters

### C

`C` *extends* [`DeclaredCatalogs`](DeclaredCatalogs.md) = `EmptyCatalog`

## Properties

### activity

> `readonly` **activity**: [`ActivityResource`](ActivityResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"activity"`\>\>

Defined in: [src/client.ts:148](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L148)

***

### attachment

> `readonly` **attachment**: [`AttachmentAccessor`](AttachmentAccessor.md)

Defined in: [src/client.ts:163](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L163)

Attachments, reached through the resource they belong to: `t.attachment.of("resume")`.
PORTERS requires that `resource` on every Attachment Read, and the same value fills the
`<Resource>` field on write, so it is bound once (ADR-0080 / ADR-0081).

***

### candidate

> `readonly` **candidate**: [`CandidateResource`](CandidateResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"candidate"`\>\>

Defined in: [src/client.ts:142](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L142)

***

### client

> `readonly` **client**: [`ClientResource`](ClientResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"client"`\>\>

Defined in: [src/client.ts:144](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L144)

***

### contact

> `readonly` **contact**: [`ContactResource`](ContactResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contact"`\>\>

Defined in: [src/client.ts:146](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L146)

***

### contract

> `readonly` **contract**: [`ContractResource`](ContractResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contract"`\>\>

Defined in: [src/client.ts:149](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L149)

***

### department

> `readonly` **department**: [`DepartmentResource`](DepartmentResource.md)

Defined in: [src/client.ts:170](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L170)

Department master Read (Connect API 8.2.1+): the user departments a department-typed Link field
or `User.P_Department` points at. Read-only, listed whole — no filter, no `get(id)`. Covered
by the `user_r` scope (PORTERS defines no `department_r`).

***

### field

> `readonly` **field**: [`FieldAccessor`](FieldAccessor.md)

Defined in: [src/client.ts:176](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L176)

Field master Read, reached through the resource whose catalog you want:
`t.field.of("candidate")`. PORTERS requires `resource=` on every Field Read, so it is bound
once (ADR-0080).

***

### job

> `readonly` **job**: [`JobResource`](JobResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"job"`\>\>

Defined in: [src/client.ts:143](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L143)

***

### opportunity

> `readonly` **opportunity**: [`OpportunityResource`](OpportunityResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"opportunity"`\>\>

Defined in: [src/client.ts:147](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L147)

***

### option

> `readonly` **option**: [`OptionResource`](OptionResource.md)

Defined in: [src/client.ts:177](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L177)

***

### phase

> `readonly` **phase**: [`PhaseAccessor`](PhaseAccessor.md)

Defined in: [src/client.ts:155](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L155)

Phase history, reached through the resource it belongs to: `t.phase.of("client")`.
PORTERS requires that `resource` on every Phase call, so it is bound once (ADR-0061 案2a).

***

### process

> `readonly` **process**: [`ProcessResource`](ProcessResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"process"`\>\>

Defined in: [src/client.ts:156](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L156)

***

### recruiter

> `readonly` **recruiter**: [`RecruiterResource`](RecruiterResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"recruiter"`\>\>

Defined in: [src/client.ts:145](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L145)

***

### resume

> `readonly` **resume**: [`ResumeResource`](ResumeResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"resume"`\>\>

Defined in: [src/client.ts:157](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L157)

***

### sales

> `readonly` **sales**: [`SalesResource`](SalesResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"sales"`\>\>

Defined in: [src/client.ts:150](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L150)

***

### user

> `readonly` **user**: [`UserResource`](UserResource.md)

Defined in: [src/client.ts:164](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L164)
