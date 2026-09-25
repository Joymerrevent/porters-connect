[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TenantScope

# Type Alias: TenantScope\<C\>

> **TenantScope**\<`C`\> = `object`

Defined in: [src/client.ts:162](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L162)

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

Defined in: [src/client.ts:184](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L184)

***

### attachment

> `readonly` **attachment**: [`AttachmentAccessor`](AttachmentAccessor.md)

Defined in: [src/client.ts:213](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L213)

Attachments, reached through the resource they belong to: `t.attachment.of("resume")`.
PORTERS requires that `resource` on every Attachment Read, and the same value fills the
`<Resource>` field on write, so it is bound once.

***

### candidate

> `readonly` **candidate**: [`CandidateResource`](CandidateResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"candidate"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"candidate"`\>\>

Defined in: [src/client.ts:163](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L163)

***

### client

> `readonly` **client**: [`ClientResource`](ClientResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"client"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"client"`\>\>

Defined in: [src/client.ts:168](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L168)

***

### contact

> `readonly` **contact**: [`ContactResource`](ContactResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contact"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"contact"`\>\>

Defined in: [src/client.ts:176](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L176)

***

### contract

> `readonly` **contract**: [`ContractResource`](ContractResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contract"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"contract"`\>\>

Defined in: [src/client.ts:188](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L188)

***

### department

> `readonly` **department**: [`DepartmentResource`](DepartmentResource.md)

Defined in: [src/client.ts:220](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L220)

Department master Read (Connect API 8.2.1+): the user departments a department-typed Link field
or `User.P_Department` points at. Read-only, listed whole — no filter, no `get(id)`. Covered
by the `user_r` scope (PORTERS defines no `department_r`).

***

### field

> `readonly` **field**: [`FieldAccessor`](FieldAccessor.md)

Defined in: [src/client.ts:227](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L227)

Field master Read, reached through the resource whose catalog you want:
`t.field.of("candidate")`. PORTERS requires `resource=` on every Field Read, so it is bound
once.

***

### job

> `readonly` **job**: [`JobResource`](JobResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"job"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"job"`\>\>

Defined in: [src/client.ts:167](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L167)

***

### opportunity

> `readonly` **opportunity**: [`OpportunityResource`](OpportunityResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"opportunity"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"opportunity"`\>\>

Defined in: [src/client.ts:180](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L180)

***

### option

> `readonly` **option**: [`OptionResource`](OptionResource.md)

Defined in: [src/client.ts:228](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L228)

***

### phase

> `readonly` **phase**: [`PhaseAccessor`](PhaseAccessor.md)

Defined in: [src/client.ts:198](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L198)

Phase history, reached through the resource it belongs to: `t.phase.of("client")`.
PORTERS requires that `resource` on every Phase call, so it is bound once.

***

### process

> `readonly` **process**: [`ProcessResource`](ProcessResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"process"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"process"`\>\>

Defined in: [src/client.ts:199](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L199)

***

### recruiter

> `readonly` **recruiter**: [`RecruiterResource`](RecruiterResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"recruiter"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"recruiter"`\>\>

Defined in: [src/client.ts:172](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L172)

***

### resume

> `readonly` **resume**: [`ResumeResource`](ResumeResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"resume"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"resume"`\>\>

Defined in: [src/client.ts:203](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L203)

***

### sales

> `readonly` **sales**: [`SalesResource`](SalesResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"sales"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"sales"`\>\>

Defined in: [src/client.ts:192](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L192)

***

### user

> `readonly` **user**: [`UserResource`](UserResource.md)

Defined in: [src/client.ts:214](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L214)
