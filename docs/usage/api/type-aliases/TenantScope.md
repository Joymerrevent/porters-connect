[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TenantScope

# Type Alias: TenantScope\<C\>

> **TenantScope**\<`C`\> = `object`

Defined in: [src/porters-client.ts:168](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L168)

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

Defined in: [src/porters-client.ts:190](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L190)

***

### attachment

> `readonly` **attachment**: [`AttachmentAccessor`](AttachmentAccessor.md)

Defined in: [src/porters-client.ts:219](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L219)

Attachments, reached through the resource they belong to: `t.attachment.of("resume")`.
PORTERS requires that `resource` on every Attachment Read, and the same value fills the
`<Resource>` field on write, so it is bound once.

***

### candidate

> `readonly` **candidate**: [`CandidateResource`](CandidateResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"candidate"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"candidate"`\>\>

Defined in: [src/porters-client.ts:169](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L169)

***

### client

> `readonly` **client**: [`ClientResource`](ClientResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"client"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"client"`\>\>

Defined in: [src/porters-client.ts:174](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L174)

***

### contact

> `readonly` **contact**: [`ContactResource`](ContactResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contact"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"contact"`\>\>

Defined in: [src/porters-client.ts:182](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L182)

***

### contract

> `readonly` **contract**: [`ContractResource`](ContractResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contract"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"contract"`\>\>

Defined in: [src/porters-client.ts:194](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L194)

***

### department

> `readonly` **department**: [`DepartmentResource`](DepartmentResource.md)

Defined in: [src/porters-client.ts:226](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L226)

Department master Read (Connect API 8.2.1+): the user departments a department-typed Link field
or `User.P_Department` points at. Read-only, listed whole — no filter, no `get(id)`. Covered
by the `user_r` scope (PORTERS defines no `department_r`).

***

### field

> `readonly` **field**: [`FieldAccessor`](FieldAccessor.md)

Defined in: [src/porters-client.ts:233](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L233)

Field master Read, reached through the resource whose catalog you want:
`t.field.of("candidate")`. PORTERS requires `resource=` on every Field Read, so it is bound
once.

***

### job

> `readonly` **job**: [`JobResource`](JobResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"job"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"job"`\>\>

Defined in: [src/porters-client.ts:173](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L173)

***

### opportunity

> `readonly` **opportunity**: [`OpportunityResource`](OpportunityResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"opportunity"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"opportunity"`\>\>

Defined in: [src/porters-client.ts:186](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L186)

***

### option

> `readonly` **option**: [`OptionResource`](OptionResource.md)

Defined in: [src/porters-client.ts:234](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L234)

***

### phase

> `readonly` **phase**: [`PhaseAccessor`](PhaseAccessor.md)

Defined in: [src/porters-client.ts:204](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L204)

Phase history, reached through the resource it belongs to: `t.phase.of("client")`.
PORTERS requires that `resource` on every Phase call, so it is bound once.

***

### process

> `readonly` **process**: [`ProcessResource`](ProcessResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"process"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"process"`\>\>

Defined in: [src/porters-client.ts:205](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L205)

***

### recruiter

> `readonly` **recruiter**: [`RecruiterResource`](RecruiterResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"recruiter"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"recruiter"`\>\>

Defined in: [src/porters-client.ts:178](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L178)

***

### resume

> `readonly` **resume**: [`ResumeResource`](ResumeResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"resume"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"resume"`\>\>

Defined in: [src/porters-client.ts:209](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L209)

***

### sales

> `readonly` **sales**: [`SalesResource`](SalesResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"sales"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"sales"`\>\>

Defined in: [src/porters-client.ts:198](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L198)

***

### user

> `readonly` **user**: [`UserResource`](UserResource.md)

Defined in: [src/porters-client.ts:220](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters-client.ts#L220)
