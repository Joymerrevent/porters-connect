[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / TenantScope

# Type Alias: TenantScope\<C\>

> **TenantScope**\<`C`\> = `object`

Defined in: [src/client.ts:167](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L167)

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

Defined in: [src/client.ts:189](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L189)

***

### attachment

> `readonly` **attachment**: [`AttachmentAccessor`](AttachmentAccessor.md)

Defined in: [src/client.ts:218](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L218)

Attachments, reached through the resource they belong to: `t.attachment.of("resume")`.
PORTERS requires that `resource` on every Attachment Read, and the same value fills the
`<Resource>` field on write, so it is bound once.

***

### candidate

> `readonly` **candidate**: [`CandidateResource`](CandidateResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"candidate"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"candidate"`\>\>

Defined in: [src/client.ts:168](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L168)

***

### client

> `readonly` **client**: [`ClientResource`](ClientResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"client"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"client"`\>\>

Defined in: [src/client.ts:173](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L173)

***

### contact

> `readonly` **contact**: [`ContactResource`](ContactResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contact"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"contact"`\>\>

Defined in: [src/client.ts:181](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L181)

***

### contract

> `readonly` **contract**: [`ContractResource`](ContractResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"contract"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"contract"`\>\>

Defined in: [src/client.ts:193](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L193)

***

### department

> `readonly` **department**: [`DepartmentResource`](DepartmentResource.md)

Defined in: [src/client.ts:225](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L225)

Department master Read (Connect API 8.2.1+): the user departments a department-typed Link field
or `User.P_Department` points at. Read-only, listed whole — no filter, no `get(id)`. Covered
by the `user_r` scope (PORTERS defines no `department_r`).

***

### field

> `readonly` **field**: [`FieldAccessor`](FieldAccessor.md)

Defined in: [src/client.ts:232](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L232)

Field master Read, reached through the resource whose catalog you want:
`t.field.of("candidate")`. PORTERS requires `resource=` on every Field Read, so it is bound
once.

***

### job

> `readonly` **job**: [`JobResource`](JobResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"job"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"job"`\>\>

Defined in: [src/client.ts:172](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L172)

***

### opportunity

> `readonly` **opportunity**: [`OpportunityResource`](OpportunityResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"opportunity"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"opportunity"`\>\>

Defined in: [src/client.ts:185](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L185)

***

### option

> `readonly` **option**: [`OptionResource`](OptionResource.md)

Defined in: [src/client.ts:233](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L233)

***

### phase

> `readonly` **phase**: [`PhaseAccessor`](PhaseAccessor.md)

Defined in: [src/client.ts:203](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L203)

Phase history, reached through the resource it belongs to: `t.phase.of("client")`.
PORTERS requires that `resource` on every Phase call, so it is bound once.

***

### process

> `readonly` **process**: [`ProcessResource`](ProcessResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"process"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"process"`\>\>

Defined in: [src/client.ts:204](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L204)

***

### recruiter

> `readonly` **recruiter**: [`RecruiterResource`](RecruiterResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"recruiter"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"recruiter"`\>\>

Defined in: [src/client.ts:177](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L177)

***

### resume

> `readonly` **resume**: [`ResumeResource`](ResumeResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"resume"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"resume"`\>\>

Defined in: [src/client.ts:208](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L208)

***

### sales

> `readonly` **sales**: [`SalesResource`](SalesResource.md)\<[`CustomFor`](CustomFor.md)\<`C`, `"sales"`\>, [`RequiredFor`](RequiredFor.md)\<`C`, `"sales"`\>\>

Defined in: [src/client.ts:197](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L197)

***

### user

> `readonly` **user**: [`UserResource`](UserResource.md)

Defined in: [src/client.ts:219](https://github.com/Joymerrevent/porters-connect/blob/main/src/client.ts#L219)
