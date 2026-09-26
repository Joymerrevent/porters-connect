[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TenantScope

# Type Alias: TenantScope\<C\>

> **TenantScope**\<`C`\> = `object`

Defined in: [src/porters-client.ts:169](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L169)

The partition-bound resource accessors returned by [PortersClient.tenant](../classes/PortersClient.md#tenant).
**This is the only way to reach a partition-scoped resource**: PORTERS requires
`partition` on every one of these calls, so the API makes you supply it exactly once, explicitly.
`C` is that partition's custom field catalog, from `tenant(id, { fields })`.
`auth` (App-level), the `partition` master (discovery — partition-less), and `tenant` itself
(no nesting) are deliberately absent: none of them takes a partition.

## Type Parameters

### C

`C` *extends* [`DeclaredCatalogs`](DeclaredCatalogs.md) = `EmptyCatalog`

## Properties

### activity

> `readonly` **activity**: [`ActivityResource`](ActivityResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"activity"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"activity"`\>\>

Defined in: [src/porters-client.ts:191](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L191)

***

### attachment

> `readonly` **attachment**: [`AttachmentAccessor`](AttachmentAccessor.md)

Defined in: [src/porters-client.ts:220](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L220)

Attachments, reached through the resource they belong to: `t.attachment.of("resume")`.
PORTERS requires that `resource` on every Attachment Read, and the same value fills the
`<Resource>` field on write, so it is bound once.

***

### candidate

> `readonly` **candidate**: [`CandidateResource`](CandidateResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"candidate"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"candidate"`\>\>

Defined in: [src/porters-client.ts:170](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L170)

***

### client

> `readonly` **client**: [`ClientResource`](ClientResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"client"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"client"`\>\>

Defined in: [src/porters-client.ts:175](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L175)

***

### contact

> `readonly` **contact**: [`ContactResource`](ContactResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contact"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"contact"`\>\>

Defined in: [src/porters-client.ts:183](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L183)

***

### contract

> `readonly` **contract**: [`ContractResource`](ContractResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contract"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"contract"`\>\>

Defined in: [src/porters-client.ts:195](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L195)

***

### department

> `readonly` **department**: [`DepartmentResource`](DepartmentResource.md)

Defined in: [src/porters-client.ts:227](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L227)

Department master Read (Connect API 8.2.1+): the user departments a department-typed Link field
or `User.P_Department` points at. Read-only, listed whole — no filter, no `get(id)`. Covered
by the `user_r` scope (PORTERS defines no `department_r`).

***

### field

> `readonly` **field**: [`FieldAccessor`](FieldAccessor.md)

Defined in: [src/porters-client.ts:234](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L234)

Field master Read, reached through the resource whose catalog you want:
`t.field.of("candidate")`. PORTERS requires `resource=` on every Field Read, so it is bound
once.

***

### job

> `readonly` **job**: [`JobResource`](JobResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"job"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"job"`\>\>

Defined in: [src/porters-client.ts:174](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L174)

***

### opportunity

> `readonly` **opportunity**: [`OpportunityResource`](OpportunityResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"opportunity"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"opportunity"`\>\>

Defined in: [src/porters-client.ts:187](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L187)

***

### option

> `readonly` **option**: [`OptionResource`](OptionResource.md)

Defined in: [src/porters-client.ts:235](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L235)

***

### phase

> `readonly` **phase**: [`PhaseAccessor`](PhaseAccessor.md)

Defined in: [src/porters-client.ts:205](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L205)

Phase history, reached through the resource it belongs to: `t.phase.of("client")`.
PORTERS requires that `resource` on every Phase call, so it is bound once.

***

### process

> `readonly` **process**: [`ProcessResource`](ProcessResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"process"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"process"`\>\>

Defined in: [src/porters-client.ts:206](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L206)

***

### recruiter

> `readonly` **recruiter**: [`RecruiterResource`](RecruiterResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"recruiter"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"recruiter"`\>\>

Defined in: [src/porters-client.ts:179](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L179)

***

### resume

> `readonly` **resume**: [`ResumeResource`](ResumeResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"resume"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"resume"`\>\>

Defined in: [src/porters-client.ts:210](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L210)

***

### sales

> `readonly` **sales**: [`SalesResource`](SalesResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"sales"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"sales"`\>\>

Defined in: [src/porters-client.ts:199](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L199)

***

### user

> `readonly` **user**: [`UserResource`](UserResource.md)

Defined in: [src/porters-client.ts:221](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L221)
